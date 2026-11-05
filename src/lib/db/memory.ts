import { uuidv7 } from "@/lib/ids";
import { byNewest, matchesQuery } from "@/lib/jobs/query";
import type { EmployerDoc, JobDoc, SavedJob, SearchProfile, SourceRun } from "@/lib/jobs/types";
import type { AuditEntry, BillingAccount, Db, Entitlement, Suppression, WebhookDelivery, WebhookEndpoint } from "./types";

/** In-memory Db for tests, local dev and stub mode. Same semantics as the Mongo driver (dbContract.ts). */
export function createMemoryDb(app: string, config: Record<string, string> = {}): Db {
  const accounts = new Map<string, BillingAccount>();
  const ents = new Map<string, Entitlement>();
  const events = new Set<string>();
  const usage = new Map<string, number>();
  const limits = new Map<string, number[]>();
  const audit: AuditEntry[] = [];
  const endpoints = new Map<string, WebhookEndpoint>();
  const deliveries = new Map<string, WebhookDelivery>();
  const suppressions = new Map<string, Suppression>();
  const employers = new Map<string, EmployerDoc>();
  const leases = new Map<string, { owner: string; until: number }>();
  const jobs = new Map<string, JobDoc>();
  const runs: SourceRun[] = [];
  const opens = new Set<string>();
  const saved = new Map<string, SavedJob>();
  const profiles = new Map<string, SearchProfile>();
  const cfg = new Map(Object.entries(config));
  const clone = <T>(x: T): T => structuredClone(x);
  const sKey = (email: string, scope = "all") => `${email.toLowerCase()}|${scope}`;

  return {
    app,
    async getBillingAccount(id) {
      const a = accounts.get(id);
      return a ? clone(a) : null;
    },
    async upsertBillingAccount(a) {
      const prev = accounts.get(a.id);
      accounts.set(a.id, { ...prev, ...a, app, createdAt: prev?.createdAt ?? a.createdAt ?? new Date() });
    },
    async findBillingAccountByCustomer(c) {
      const a = [...accounts.values()].find((x) => x.stripeCustomerId === c);
      return a ? clone(a) : null;
    },
    async getEntitlement(id) {
      const e = ents.get(id);
      return e ? clone(e) : null;
    },
    async setEntitlement(id, e) {
      ents.set(id, clone(e));
    },
    async hasStripeEvent(id) {
      return events.has(id);
    },
    async markStripeEvent(id) {
      if (events.has(id)) return false;
      events.add(id);
      return true;
    },
    async incUsage(orgId, meter, period, by = 1) {
      const k = `${orgId}|${meter}|${period}`;
      const v = (usage.get(k) ?? 0) + by;
      usage.set(k, v);
      return v;
    },
    async getUsage(orgId, meter, period) {
      return usage.get(`${orgId}|${meter}|${period}`) ?? 0;
    },
    async hitRateLimit(key, windowMs, now = Date.now()) {
      const hits = (limits.get(key) ?? []).filter((t) => t > now - windowMs);
      hits.push(now);
      limits.set(key, hits);
      return hits.length;
    },
    async appendAudit(e) {
      const entry: AuditEntry = { ...e, id: uuidv7(), app, at: e.at ?? new Date() };
      audit.push(Object.freeze(clone(entry)));
      return clone(entry);
    },
    async listAudit(orgId, { limit = 50, before } = {}) {
      return audit
        .filter((a) => a.orgId === orgId && (!before || a.at < before))
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, limit)
        .map(clone);
    },
    async createWebhookEndpoint(e) {
      const ep: WebhookEndpoint = { ...e, app, createdAt: new Date() };
      endpoints.set(ep.id, ep);
      return clone(ep);
    },
    async listWebhookEndpoints(orgId) {
      return [...endpoints.values()].filter((e) => e.orgId === orgId).map(clone);
    },
    async getWebhookEndpoint(orgId, id) {
      const e = endpoints.get(id);
      return e && e.orgId === orgId ? clone(e) : null;
    },
    async updateWebhookEndpoint(orgId, id, patch) {
      const e = endpoints.get(id);
      if (e && e.orgId === orgId) endpoints.set(id, { ...e, ...patch });
    },
    async deleteWebhookEndpoint(orgId, id) {
      const e = endpoints.get(id);
      if (e && e.orgId === orgId) endpoints.delete(id);
    },
    async createDelivery(d) {
      deliveries.set(d.id, { ...clone(d), app });
    },
    async updateDelivery(id, patch) {
      const d = deliveries.get(id);
      if (d) deliveries.set(id, { ...d, ...clone(patch) });
    },
    async listDeliveries(orgId, { endpointId, limit = 50 } = {}) {
      return [...deliveries.values()]
        .filter((d) => d.orgId === orgId && (!endpointId || d.endpointId === endpointId))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
        .map(clone);
    },
    async getDelivery(orgId, id) {
      const d = deliveries.get(id);
      return d && d.orgId === orgId ? clone(d) : null;
    },
    async dueDeliveries(now, limit) {
      return [...deliveries.values()]
        .filter((d) => (d.status === "pending" || d.status === "retrying") && d.nextAttemptAt && d.nextAttemptAt <= now)
        .sort((a, b) => a.nextAttemptAt!.getTime() - b.nextAttemptAt!.getTime())
        .slice(0, limit)
        .map(clone);
    },
    async addSuppression(s) {
      suppressions.set(sKey(s.email, s.scope), { ...s, email: s.email.toLowerCase(), at: s.at ?? new Date() });
    },
    async isSuppressed(email, scope = "all") {
      return suppressions.has(sKey(email, "all")) || suppressions.has(sKey(email, scope));
    },
    async removeSuppression(email, scope = "all") {
      suppressions.delete(sKey(email, scope));
    },
    async getConfig() {
      return Object.fromEntries(cfg);
    },
    async setConfig(k, v) {
      cfg.set(k, v);
    },
    async upsertEmployer(e, now, seed = false) {
      const id = e.ats === "jsonld" ? `jsonld:${e.slug}` : `${e.ats}:${e.slug}`;
      if (employers.has(id)) return false;
      employers.set(id, { ...e, id, status: "active", failCount: 0, lastCrawledAt: null, nextCrawlAt: now, suppressed: false, seed });
      return true;
    },
    async getEmployer(id) {
      const e = employers.get(id);
      return e ? clone(e) : null;
    },
    async listEmployers() {
      return [...employers.values()].map(clone);
    },
    async dueEmployers(now, limit) {
      return [...employers.values()]
        .filter((e) => e.status === "active" && !e.suppressed && e.nextCrawlAt <= now)
        .sort((a, b) => a.nextCrawlAt.getTime() - b.nextCrawlAt.getTime() || a.id.localeCompare(b.id))
        .slice(0, limit)
        .map(clone);
    },
    async patchEmployer(id, patch) {
      const e = employers.get(id);
      if (e) employers.set(id, { ...e, ...clone(patch) });
    },
    async tryLease(key, owner, now, ttlMs) {
      const l = leases.get(key);
      if (l && l.until > now.getTime() && l.owner !== owner) return false;
      leases.set(key, { owner, until: now.getTime() + ttlMs });
      return true;
    },
    async releaseLease(key, owner) {
      if (leases.get(key)?.owner === owner) leases.delete(key);
    },
    async upsertJobs(list, now) {
      let inserted = 0;
      let updated = 0;
      for (const u of list) {
        const prev = jobs.get(u.id);
        const base = { ...clone(u), lastSeenAt: now, closedAt: null, missCount: 0 };
        if (prev) {
          jobs.set(u.id, { ...base, firstSeenAt: prev.firstSeenAt, postedAt: u.firstPublishedAt ?? prev.postedAt });
          updated++;
        } else {
          jobs.set(u.id, { ...base, firstSeenAt: now, postedAt: u.firstPublishedAt ?? now });
          inserted++;
        }
      }
      return { inserted, updated };
    },
    async closeMissing(employerId, seen, now, threshold = 2) {
      const set = new Set(seen);
      let closed = 0;
      for (const j of jobs.values()) {
        if (j.employerId !== employerId || j.closedAt || set.has(j.externalId)) continue;
        j.missCount += 1;
        if (j.missCount >= threshold) {
          j.closedAt = now;
          closed++;
        }
      }
      return closed;
    },
    async closeByExternalIds(employerId, ids, now) {
      const set = new Set(ids);
      let closed = 0;
      for (const j of jobs.values()) {
        if (j.employerId === employerId && !j.closedAt && set.has(j.externalId)) {
          j.closedAt = now;
          closed++;
        }
      }
      return closed;
    },
    async jobsByDedupeKeys(keys) {
      const set = new Set(keys);
      return [...jobs.values()].filter((j) => set.has(j.dedupeKey)).map((j) => ({ id: j.id, dedupeKey: j.dedupeKey, firstSeenAt: new Date(j.firstSeenAt) }));
    },
    async getJob(id) {
      const j = jobs.get(id);
      return j ? clone(j) : null;
    },
    async getJobs(ids) {
      return ids.map((i) => jobs.get(i)).filter((j): j is JobDoc => !!j).map(clone);
    },
    async queryJobs(q) {
      const all = [...jobs.values()].filter((j) => matchesQuery(j, q)).sort(byNewest);
      return all.slice(q.skip ?? 0, (q.skip ?? 0) + (q.limit ?? 20)).map(clone);
    },
    async countJobs(q) {
      let n = 0;
      for (const j of jobs.values()) if (matchesQuery(j, q)) n++;
      return n;
    },
    async countAgencyHidden(q) {
      let n = 0;
      for (const j of jobs.values()) if (j.agencyFlag === "yes" && matchesQuery(j, { ...q, includeAgency: true })) n++;
      return n;
    },
    async recordSourceRun(r) {
      runs.push(clone(r));
    },
    async listSourceRuns(limit) {
      return runs.slice(-limit).reverse().map(clone);
    },
    async recordOpen(orgId, day, jobId) {
      const k = `${orgId}|${day}|${jobId}`;
      if (opens.has(k)) return false;
      opens.add(k);
      return true;
    },
    async hasOpened(orgId, day, jobId) {
      return opens.has(`${orgId}|${day}|${jobId}`);
    },
    async saveJob(orgId, jobId, now) {
      const k = `${orgId}|${jobId}`;
      if (saved.has(k)) return false;
      saved.set(k, { orgId, jobId, savedAt: now });
      return true;
    },
    async unsaveJob(orgId, jobId) {
      return saved.delete(`${orgId}|${jobId}`);
    },
    async listSaved(orgId) {
      return [...saved.values()].filter((s) => s.orgId === orgId).sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime()).map(clone);
    },
    async getProfile(orgId) {
      const p = profiles.get(orgId);
      return p ? clone(p) : null;
    },
    async saveProfile(p) {
      profiles.set(p.orgId, clone(p));
    },
    async listProfiles({ digest, alerts }) {
      return [...profiles.values()].filter((p) => (digest === undefined || p.digest === digest) && (alerts === undefined || p.alerts === alerts)).map(clone);
    },
    async exportOrgData(orgId) {
      return {
        profile: profiles.get(orgId) ?? null,
        savedJobs: [...saved.values()].filter((s) => s.orgId === orgId),
        billingAccount: accounts.get(orgId) ?? null,
        entitlement: ents.get(orgId) ?? null,
        webhookEndpoints: [...endpoints.values()].filter((e) => e.orgId === orgId).map(({ secret: _s, ...rest }) => rest),
        auditLog: audit.filter((a) => a.orgId === orgId),
      };
    },
    async deleteOrgData(orgId) {
      accounts.delete(orgId);
      ents.delete(orgId);
      for (const [k] of usage) if (k.startsWith(`${orgId}|`)) usage.delete(k);
      for (const [k, e] of endpoints) if (e.orgId === orgId) endpoints.delete(k);
      for (const [k, d] of deliveries) if (d.orgId === orgId) deliveries.delete(k);
      profiles.delete(orgId);
      for (const [k, sv] of saved) if (sv.orgId === orgId) saved.delete(k);
      for (const k of opens) if (k.startsWith(`${orgId}|`)) opens.delete(k);
      // The audit log is append-only: entries are kept (no PII beyond ids) per the privacy policy.
    },
  };
}
