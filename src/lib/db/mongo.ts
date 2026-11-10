import { MongoClient, type Collection, type Db as MongoDatabase, type Document } from "mongodb";
import { mongoFilter } from "@/lib/jobs/query";
import type { AgencyFlag } from "@/lib/classify/types";
import { CRAWL_RECORD_DAYS } from "@/lib/jobs/retention";
import type { AlertRule, EmployerDoc, JobDoc, SavedJob, SearchProfile, SourceRun } from "@/lib/jobs/types";
import { uuidv7 } from "@/lib/ids";
import { DELIVERY_TTL_DAYS, type AuditEntry, type BillingAccount, type Db, type DisputeRecord, type Entitlement, type LabelDoc, type RefundRecord, type Suppression, type WebhookDelivery, type WebhookEndpoint } from "./types";

// Ported from trayo server/db/mongo.ts. Changes: global singleton client (Vercel), pool 10, Date TTLs,
// stripe events recorded after success, no sync/family/anonymous. Use only from runtime = "nodejs" routes.

declare global {
  var __kitMongo: { uri: string; client: Promise<MongoClient> } | undefined;
}

export function mongoClient(uri: string): Promise<MongoClient> {
  if (globalThis.__kitMongo?.uri === uri) return globalThis.__kitMongo.client;
  const client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000, appName: "buffersol-kit" }).connect();
  globalThis.__kitMongo = { uri, client };
  client.catch(() => {
    if (globalThis.__kitMongo?.client === client) globalThis.__kitMongo = undefined;
  });
  return client;
}

type WithId<T> = T & { _id: string };

export function createMongoDb(uri: string, dbName: string, app: string): Db {
  let dbp: Promise<MongoDatabase> | null = null;
  const db = () =>
    (dbp ??= mongoClient(uri).then((c) => {
      void ensureIndexesOnce(`${uri}|${dbName}`, async () => c.db(dbName));
      return c.db(dbName);
    }));
  const col = async <T extends Document>(name: string) => (await db()).collection<T>(name) as unknown as Collection<T>;
  const strip = <T>(d: (T & { _id?: unknown; app?: string }) | null): T | null => {
    if (!d) return null;
    const { _id: _i, ...rest } = d as Record<string, unknown>;
    return rest as T;
  };

  /** Strip storage fields (_id, app) from a doc. */
  const clean = <T>(d: Record<string, unknown> | null): T | null => {
    if (!d) return null;
    const { _id: _i, app: _a, ...rest } = d;
    return rest as T;
  };
  const cleanAll = <T>(ds: Record<string, unknown>[]): T[] => ds.map((d) => clean<T>(d)!);

  return {
    app,
    async getBillingAccount(id) {
      return strip<BillingAccount>(await (await col<WithId<BillingAccount>>("billing_accounts")).findOne({ _id: id, app }));
    },
    async upsertBillingAccount(a) {
      const { createdAt, ...rest } = a;
      await (await col<WithId<BillingAccount>>("billing_accounts")).updateOne(
        { _id: a.id },
        { $set: { ...rest, app }, $setOnInsert: { createdAt: createdAt ?? new Date() } },
        { upsert: true },
      );
    },
    async findBillingAccountByCustomer(c) {
      return strip<BillingAccount>(await (await col<WithId<BillingAccount>>("billing_accounts")).findOne({ app, stripeCustomerId: c }));
    },
    async claimLifetime(orgId, cap) {
      const claims = await col<Document>("lifetime_claims");
      const counters = await col<Document>("counters");
      const key = `${app}:${orgId}`;
      if (await claims.findOne({ _id: key as never })) return { ok: true, sold: await this.lifetimeSold() };
      // Atomic: the filter only matches while n < cap, so a full counter makes the upsert collide on _id (E11000) = sold out.
      try {
        const r = await counters.findOneAndUpdate({ _id: `${app}:lifetime` as never, n: { $lt: cap } }, { $inc: { n: 1 }, $set: { app } }, { upsert: true, returnDocument: "after" });
        try {
          await claims.insertOne({ _id: key as never, app, orgId, at: new Date() });
        } catch (e) {
          if ((e as { code?: number }).code !== 11000) throw e;
          await counters.updateOne({ _id: `${app}:lifetime` as never }, { $inc: { n: -1 } }); // lost a race with ourselves: undo
        }
        return { ok: true, sold: Number(r?.n ?? 0) };
      } catch (e) {
        if ((e as { code?: number }).code === 11000) return { ok: false, sold: await this.lifetimeSold() };
        throw e;
      }
    },
    async releaseLifetime(orgId) {
      const gone = await (await col<Document>("lifetime_claims")).deleteOne({ _id: `${app}:${orgId}` as never });
      if (gone.deletedCount > 0) await (await col<Document>("counters")).updateOne({ _id: `${app}:lifetime` as never }, { $inc: { n: -1 } });
    },
    async lifetimeSold() {
      return Number((await (await col<Document>("counters")).findOne({ _id: `${app}:lifetime` as never }))?.n ?? 0);
    },
    async reserveRefund(r) {
      const refunds = await col<Document>("refunds");
      const dup = (e: unknown) => (e as { code?: number }).code === 11000;
      try {
        await refunds.insertOne({ _id: `${app}:${r.customerId}` as never, ...r, app });
      } catch (e) {
        if (dup(e)) return false;
        throw e;
      }
      if (r.emailHash) {
        // Second key: the verified email, so a new Stripe customer for the same person is refused too.
        try {
          await refunds.insertOne({ _id: `${app}:email:${r.emailHash}` as never, ...r, app });
        } catch (e) {
          await refunds.deleteOne({ _id: `${app}:${r.customerId}` as never });
          if (dup(e)) return false;
          throw e;
        }
      }
      return true;
    },
    async releaseRefund(customerId) {
      const refunds = await col<Document>("refunds");
      const doc = await refunds.findOne({ _id: `${app}:${customerId}` as never });
      await refunds.deleteOne({ _id: `${app}:${customerId}` as never });
      if (doc?.emailHash) await refunds.deleteOne({ _id: `${app}:email:${doc.emailHash}` as never });
    },
    async getRefund(customerId, emailHash) {
      const refunds = await col<Document>("refunds");
      const doc = (await refunds.findOne({ _id: `${app}:${customerId}` as never })) ?? (emailHash ? await refunds.findOne({ _id: `${app}:email:${emailHash}` as never }) : null);
      return clean<RefundRecord>(doc);
    },
    async setDispute(d) {
      await (await col<Document>("disputes")).replaceOne({ _id: `${app}:${d.id}` as never }, { ...d, app }, { upsert: true });
    },
    async listDisputes(orgId) {
      const docs = await (await col<Document>("disputes")).find({ app, orgId }).toArray();
      return docs.map((x) => {
        const { _id, app: _a, ...rest } = x;
        return rest as unknown as DisputeRecord;
      });
    },
    async listEntitlements() {
      const docs = await (await col<Document>("entitlements")).find({ app, isPaid: true, status: { $ne: "lifetime" } }).toArray();
      return docs.map((d) => {
        const { _id, app: _a, ...rest } = d;
        return { orgId: String(_id), entitlement: rest as unknown as Entitlement };
      });
    },
    async markReminder(key) {
      try {
        await (await col<Document>("reminders")).insertOne({ _id: `${app}:${key}` as never, app, expireAt: new Date(Date.now() + 40 * 864e5) });
        return true;
      } catch (e) {
        if ((e as { code?: number }).code === 11000) return false;
        throw e;
      }
    },
    async setSuspended(orgId, on, by) {
      const c = await col<Document>("suspensions");
      if (on) await c.updateOne({ _id: `${app}:${orgId}` as never }, { $set: { app, orgId, by, at: new Date() } }, { upsert: true });
      else await c.deleteOne({ _id: `${app}:${orgId}` as never });
    },
    async isSuspended(orgId) {
      return !!(await (await col<Document>("suspensions")).findOne({ _id: `${app}:${orgId}` as never }, { projection: { _id: 1 } }));
    },
    async addLabel(l) {
      await (await col<Document>("labels")).replaceOne({ _id: `${app}:${l.jobId}` as never }, { ...l, app }, { upsert: true });
    },
    async listLabels(limit = 5000) {
      return cleanAll<LabelDoc>(await (await col<Document>("labels")).find({ app }).sort({ at: -1 }).limit(limit).toArray());
    },
    async listPendingAgency(limit) {
      const docs = await (await col<Document>("jobs")).find({ app, closedAt: null, agencyFlag: "pending" }).sort({ postedAt: -1 }).limit(limit).toArray();
      return docs.map((d) => ({ ...clean<JobDoc>(d)!, id: String(d._id) }) as JobDoc);
    },
    async setJobAgency(id, flag: AgencyFlag, score) {
      await (await col<Document>("jobs")).updateOne({ _id: id as never, app }, { $set: { agencyFlag: flag, agencyScore: score } });
    },
    async getEntitlement(id) {
      const d = await (await col<WithId<Entitlement & { app: string }>>("entitlements")).findOne({ _id: id, app });
      if (!d) return null;
      const { _id: _i, app: _a, ...rest } = d;
      return rest as Entitlement;
    },
    async setEntitlement(id, e) {
      await (await col<WithId<Entitlement & { app: string }>>("entitlements")).replaceOne({ _id: id }, { ...e, app }, { upsert: true });
    },
    async hasStripeEvent(id) {
      return !!(await (await col<{ _id: string }>("stripe_events")).findOne({ _id: id }, { projection: { _id: 1 } }));
    },
    async markStripeEvent(id, type) {
      try {
        // expireAt (Date) lets Mongo TTL drop rows after Stripe's 30 day retry horizon.
        await (await col<{ _id: string; app: string; type: string; at: Date; expireAt: Date }>("stripe_events")).insertOne({
          _id: id, app, type, at: new Date(), expireAt: new Date(Date.now() + 35 * 864e5),
        });
        return true;
      } catch (e) {
        if ((e as { code?: number }).code === 11000) return false;
        throw e;
      }
    },
    async incUsage(orgId, meter, period, by = 1) {
      const r = await (await col<{ _id: string; app: string; orgId: string; meter: string; period: string; value: number }>("usage")).findOneAndUpdate(
        { _id: `${orgId}|${meter}|${period}` },
        { $inc: { value: by }, $setOnInsert: { app, orgId, meter, period } },
        { upsert: true, returnDocument: "after" },
      );
      return r?.value ?? by;
    },
    async getUsage(orgId, meter, period) {
      const d = await (await col<{ _id: string; value: number }>("usage")).findOne({ _id: `${orgId}|${meter}|${period}` });
      return d?.value ?? 0;
    },
    async hitRateLimit(key, windowMs, now = Date.now()) {
      // One atomic pipeline update: drop hits outside the window, push this one, bump the TTL Date.
      const r = await (await col<{ _id: string; hits: number[]; expireAt: Date }>("rate_limits")).findOneAndUpdate(
        { _id: `${app}:${key}` },
        [
          {
            $set: {
              hits: {
                $concatArrays: [
                  { $filter: { input: { $ifNull: ["$hits", []] }, as: "h", cond: { $gt: ["$$h", now - windowMs] } } },
                  [now],
                ],
              },
              expireAt: new Date(now + windowMs),
            },
          },
        ],
        { upsert: true, returnDocument: "after" },
      );
      return r?.hits.length ?? 1;
    },
    async appendAudit(e) {
      const entry: AuditEntry = { ...e, id: uuidv7(), app, at: e.at ?? new Date() };
      await (await col<WithId<AuditEntry>>("audit_log")).insertOne({ _id: entry.id, ...entry });
      return entry;
    },
    async listAudit(orgId, { limit = 50, before } = {}) {
      const docs = await (await col<WithId<AuditEntry>>("audit_log"))
        .find({ app, orgId, ...(before ? { at: { $lt: before } } : {}) })
        .sort({ at: -1 })
        .limit(Math.min(limit, 200))
        .toArray();
      return docs.map((d) => strip<AuditEntry>(d)!);
    },
    async createWebhookEndpoint(e) {
      const ep: WebhookEndpoint = { ...e, app, createdAt: new Date() };
      await (await col<WithId<WebhookEndpoint>>("webhook_endpoints")).insertOne({ _id: ep.id, ...ep });
      return ep;
    },
    async listWebhookEndpoints(orgId) {
      const docs = await (await col<WithId<WebhookEndpoint>>("webhook_endpoints")).find({ app, orgId }).sort({ createdAt: 1 }).toArray();
      return docs.map((d) => strip<WebhookEndpoint>(d)!);
    },
    async getWebhookEndpoint(orgId, id) {
      return strip<WebhookEndpoint>(await (await col<WithId<WebhookEndpoint>>("webhook_endpoints")).findOne({ _id: id, orgId, app }));
    },
    async updateWebhookEndpoint(orgId, id, patch) {
      await (await col<WithId<WebhookEndpoint>>("webhook_endpoints")).updateOne({ _id: id, orgId, app }, { $set: patch });
    },
    async deleteWebhookEndpoint(orgId, id) {
      await (await col<WithId<WebhookEndpoint>>("webhook_endpoints")).deleteOne({ _id: id, orgId, app });
    },
    async createDelivery(d) {
      await (await col<WithId<WebhookDelivery>>("webhook_deliveries")).insertOne({ _id: d.id, ...d, app });
    },
    async updateDelivery(id, patch) {
      await (await col<WithId<WebhookDelivery>>("webhook_deliveries")).updateOne({ _id: id, app }, { $set: patch });
    },
    async listDeliveries(orgId, { endpointId, limit = 50 } = {}) {
      const docs = await (await col<WithId<WebhookDelivery>>("webhook_deliveries"))
        .find({ app, orgId, ...(endpointId ? { endpointId } : {}) })
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 200))
        .toArray();
      return docs.map((d) => strip<WebhookDelivery>(d)!);
    },
    async getDelivery(orgId, id) {
      return strip<WebhookDelivery>(await (await col<WithId<WebhookDelivery>>("webhook_deliveries")).findOne({ _id: id, orgId, app }));
    },
    async dueDeliveries(now, limit) {
      const docs = await (await col<WithId<WebhookDelivery>>("webhook_deliveries"))
        .find({ app, status: { $in: ["pending", "retrying"] }, nextAttemptAt: { $lte: now } })
        .sort({ nextAttemptAt: 1 })
        .limit(limit)
        .toArray();
      return docs.map((d) => strip<WebhookDelivery>(d)!);
    },
    async addSuppression(s) {
      const email = s.email.toLowerCase();
      await (await col<WithId<Suppression & { app: string }>>("suppressions")).updateOne(
        { _id: `${app}:${email}|${s.scope}` },
        { $set: { email, reason: s.reason, scope: s.scope, at: s.at ?? new Date(), app } },
        { upsert: true },
      );
    },
    async isSuppressed(email, scope = "all") {
      const e = email.toLowerCase();
      return !!(await (await col<{ _id: string }>("suppressions")).findOne({ _id: { $in: [`${app}:${e}|all`, `${app}:${e}|${scope}`] } }));
    },
    async removeSuppression(email, scope = "all") {
      await (await col<{ _id: string }>("suppressions")).deleteOne({ _id: `${app}:${email.toLowerCase()}|${scope}` });
    },
    async getConfig() {
      const docs = await (await col<{ _id: string; value: string; app: string }>("config")).find({ app }).toArray();
      return Object.fromEntries(docs.map((d) => [d._id.replace(`${app}:`, ""), d.value]));
    },
    async setConfig(k, v) {
      await (await col<{ _id: string; value: string; app: string }>("config")).updateOne({ _id: `${app}:${k}` }, { $set: { value: v, app } }, { upsert: true });
    },
    async upsertEmployer(e, now, seed = false) {
      const id = e.ats === "jsonld" ? `jsonld:${e.slug}` : `${e.ats}:${e.slug}`;
      const r = await (await col<Document>("employers")).updateOne(
        { _id: id as never },
        { $setOnInsert: { ...e, id, app, status: "active", failCount: 0, lastCrawledAt: null, nextCrawlAt: now, suppressed: false, seed } },
        { upsert: true },
      );
      return r.upsertedCount > 0;
    },
    async getEmployer(id) {
      return clean<EmployerDoc>(await (await col<Document>("employers")).findOne({ _id: id as never, app }));
    },
    async listEmployers() {
      return cleanAll<EmployerDoc>(await (await col<Document>("employers")).find({ app }).sort({ _id: 1 }).toArray());
    },
    async dueEmployers(now, limit) {
      return cleanAll<EmployerDoc>(
        await (await col<Document>("employers")).find({ app, status: "active", suppressed: false, nextCrawlAt: { $lte: now } }).sort({ nextCrawlAt: 1, _id: 1 }).limit(limit).toArray(),
      );
    },
    async patchEmployer(id, patch) {
      await (await col<Document>("employers")).updateOne({ _id: id as never, app }, { $set: patch });
    },
    async tryLease(key, owner, now, ttlMs) {
      try {
        // One atomic claim: free, expired, or already ours. A concurrent insert race surfaces as E11000 = not acquired.
        const r = await (await col<Document>("crawl_leases")).findOneAndUpdate(
          { _id: `${app}:${key}` as never, $or: [{ until: { $lte: now } }, { owner }] },
          { $set: { owner, until: new Date(now.getTime() + ttlMs), app, expireAt: new Date(now.getTime() + ttlMs + 864e5) } },
          { upsert: true, returnDocument: "after" },
        );
        return r?.owner === owner;
      } catch (e) {
        if ((e as { code?: number }).code === 11000) return false;
        throw e;
      }
    },
    async releaseLease(key, owner) {
      await (await col<Document>("crawl_leases")).deleteOne({ _id: `${app}:${key}` as never, owner });
    },
    async upsertJobs(list, now) {
      if (!list.length) return { inserted: 0, updated: 0 };
      const ops = list.map((u) => {
        const { id, firstPublishedAt, ...rest } = u;
        const set: Record<string, unknown> = { ...rest, firstPublishedAt, app, lastSeenAt: now, closedAt: null, missCount: 0 };
        const onInsert: Record<string, unknown> = { firstSeenAt: now };
        if (firstPublishedAt) set.postedAt = firstPublishedAt;
        else onInsert.postedAt = now;
        return { updateOne: { filter: { _id: id as never }, update: { $set: set, $setOnInsert: onInsert }, upsert: true } };
      });
      const r = await (await col<Document>("jobs")).bulkWrite(ops, { ordered: false });
      return { inserted: r.upsertedCount, updated: list.length - r.upsertedCount };
    },
    async closeMissing(employerId, seen, now, threshold = 2) {
      const c = await col<Document>("jobs");
      const base = { app, employerId, closedAt: null, externalId: { $nin: seen } };
      await c.updateMany(base, { $inc: { missCount: 1 } });
      const r = await c.updateMany({ ...base, missCount: { $gte: threshold } }, { $set: { closedAt: now } });
      return r.modifiedCount;
    },
    async closeByExternalIds(employerId, ids, now) {
      const r = await (await col<Document>("jobs")).updateMany({ app, employerId, closedAt: null, externalId: { $in: ids } }, { $set: { closedAt: now } });
      return r.modifiedCount;
    },
    async jobsByDedupeKeys(keys) {
      if (!keys.length) return [];
      const docs = await (await col<Document>("jobs")).find({ app, dedupeKey: { $in: keys } }, { projection: { dedupeKey: 1, firstSeenAt: 1 } }).toArray();
      return docs.map((d) => ({ id: String(d._id), dedupeKey: d.dedupeKey as string, firstSeenAt: d.firstSeenAt as Date }));
    },
    async getJob(id) {
      const d = await (await col<Document>("jobs")).findOne({ _id: id as never, app });
      return d ? ({ ...clean<JobDoc>(d)!, id } as JobDoc) : null;
    },
    async getJobs(ids) {
      if (!ids.length) return [];
      const docs = await (await col<Document>("jobs")).find({ _id: { $in: ids as never[] }, app }).toArray();
      return docs.map((d) => ({ ...clean<JobDoc>(d)!, id: String(d._id) }) as JobDoc);
    },
    async queryJobs(q) {
      const docs = await (await col<Document>("jobs"))
        .find(mongoFilter(q, app))
        .sort({ postedAt: -1, _id: 1 })
        .skip(q.skip ?? 0)
        .limit(Math.min(q.limit ?? 20, 100))
        .toArray();
      return docs.map((d) => ({ ...clean<JobDoc>(d)!, id: String(d._id) }) as JobDoc);
    },
    async countJobs(q) {
      return (await col<Document>("jobs")).countDocuments(mongoFilter(q, app));
    },
    async countAgencyHidden(q) {
      return (await col<Document>("jobs")).countDocuments({ ...mongoFilter({ ...q, includeAgency: true }, app), agencyFlag: "yes" });
    },
    async recordSourceRun(r) {
      await (await col<Document>("source_runs")).insertOne({ _id: r.id as never, ...r, app, expireAt: new Date(r.finishedAt.getTime() + CRAWL_RECORD_DAYS * 864e5) });
    },
    async listSourceRuns(limit) {
      return cleanAll<SourceRun & { expireAt?: Date }>(await (await col<Document>("source_runs")).find({ app }).sort({ startedAt: -1 }).limit(limit).toArray()) as SourceRun[];
    },
    async recordOpen(orgId, day, jobId) {
      try {
        await (await col<Document>("job_opens")).insertOne({ _id: `${app}:${orgId}|${day}|${jobId}` as never, app, orgId, day, jobId, expireAt: new Date(Date.now() + 3 * 864e5) });
        return true;
      } catch (e) {
        if ((e as { code?: number }).code === 11000) return false;
        throw e;
      }
    },
    async hasOpened(orgId, day, jobId) {
      return !!(await (await col<Document>("job_opens")).findOne({ _id: `${app}:${orgId}|${day}|${jobId}` as never }, { projection: { _id: 1 } }));
    },
    async saveJob(orgId, jobId, now) {
      const r = await (await col<Document>("saved_jobs")).updateOne(
        { _id: `${app}:${orgId}|${jobId}` as never },
        { $setOnInsert: { app, orgId, jobId, savedAt: now } },
        { upsert: true },
      );
      return r.upsertedCount > 0;
    },
    async unsaveJob(orgId, jobId) {
      return (await (await col<Document>("saved_jobs")).deleteOne({ _id: `${app}:${orgId}|${jobId}` as never })).deletedCount > 0;
    },
    async listSaved(orgId) {
      return cleanAll<SavedJob>(await (await col<Document>("saved_jobs")).find({ app, orgId }).sort({ savedAt: -1 }).toArray());
    },
    async getProfile(orgId) {
      return clean<SearchProfile>(await (await col<Document>("search_profiles")).findOne({ _id: `${app}:${orgId}` as never }));
    },
    async saveProfile(p) {
      await (await col<Document>("search_profiles")).replaceOne({ _id: `${app}:${p.orgId}` as never }, { ...p, app }, { upsert: true });
    },
    async listProfiles({ digest, alerts }) {
      const f: Record<string, unknown> = { app };
      if (digest !== undefined) f.digest = digest;
      if (alerts !== undefined) f.alerts = alerts;
      return cleanAll<SearchProfile>(await (await col<Document>("search_profiles")).find(f).toArray());
    },
    async listAlertRules(orgId) {
      return cleanAll<AlertRule>(await (await col<Document>("alert_rules")).find({ app, orgId }).sort({ createdAt: 1, _id: 1 }).toArray());
    },
    async listAlertRulesByEmail(email) {
      return cleanAll<AlertRule>(await (await col<Document>("alert_rules")).find({ app, email: email.toLowerCase() }).sort({ createdAt: 1, _id: 1 }).toArray());
    },
    async listActiveAlertRules() {
      return cleanAll<AlertRule>(await (await col<Document>("alert_rules")).find({ app, active: true }).sort({ createdAt: 1, _id: 1 }).toArray());
    },
    async saveAlertRule(r) {
      await (await col<Document>("alert_rules")).replaceOne({ _id: r.id as never }, { ...r, email: r.email.toLowerCase(), app }, { upsert: true });
    },
    async deleteAlertRule(orgId, id) {
      return (await (await col<Document>("alert_rules")).deleteOne({ _id: id as never, app, orgId })).deletedCount > 0;
    },
    async purgeClosedJobs(before) {
      const jobsCol = await col<Document>("jobs");
      const ids = (await jobsCol.find({ app, closedAt: { $lt: before } }, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id));
      if (!ids.length) return 0;
      await (await col<Document>("saved_jobs")).deleteMany({ app, jobId: { $in: ids } });
      return (await jobsCol.deleteMany({ app, _id: { $in: ids as never[] } })).deletedCount;
    },
    async purgeSourceRuns(before) {
      return (await (await col<Document>("source_runs")).deleteMany({ app, finishedAt: { $lt: before } })).deletedCount;
    },
    async exportOrgData(orgId) {
      const [profile, savedJobs] = await Promise.all([this.getProfile(orgId), this.listSaved(orgId)]);
      const alertRules = await this.listAlertRules(orgId);
      const [billingAccount, entitlement, endpoints, auditLog] = await Promise.all([
        this.getBillingAccount(orgId),
        this.getEntitlement(orgId),
        this.listWebhookEndpoints(orgId),
        this.listAudit(orgId, { limit: 200 }),
      ]);
      return { profile, alertRules, savedJobs, billingAccount, entitlement, webhookEndpoints: endpoints.map(({ secret: _s, ...rest }) => rest), auditLog };
    },
    async deleteOrgData(orgId) {
      const d = await db();
      await d.collection("billing_accounts").deleteOne({ _id: orgId as never });
      await d.collection("entitlements").deleteOne({ _id: orgId as never });
      await d.collection("usage").deleteMany({ app, orgId });
      await d.collection("webhook_endpoints").deleteMany({ app, orgId });
      await d.collection("webhook_deliveries").deleteMany({ app, orgId });
      await d.collection("search_profiles").deleteOne({ _id: `${app}:${orgId}` as never });
      await d.collection("alert_rules").deleteMany({ app, orgId });
      await d.collection("saved_jobs").deleteMany({ app, orgId });
      await d.collection("job_opens").deleteMany({ app, orgId });
    },
  };
}

/** Manual run (npm run db:indexes): errors throw. TTLs are on Date fields. */
export async function ensureIndexes(uri: string, dbName: string) {
  return createIndexes((await mongoClient(uri)).db(dbName));
}

type IndexDb = Pick<MongoDatabase, "collection">;
declare global {
  var __kitIndexes: Map<string, Promise<void>> | undefined;
}

const scrub = (m: string) => m.replace(/mongodb(\+srv)?:\/\/\S+/gi, "mongodb://***");

/**
 * Creates the indexes once per server instance, in the background (never awaited by callers, never at build).
 * createIndex is idempotent and safe across concurrent instances. Conflicts (code 85/86: same keys, other options)
 * and any other failure are logged scrubbed and skipped; the next cold start retries.
 */
export function ensureIndexesOnce(key: string, getDb: () => Promise<IndexDb>): Promise<void> | undefined {
  if (process.env.NEXT_PHASE === "phase-production-build") return undefined;
  const memo = (globalThis.__kitIndexes ??= new Map());
  const had = memo.get(key);
  if (had) return had;
  const run = (async () => {
    try {
      const d = await getDb();
      const lenient: IndexDb = {
        collection: ((name: string) => {
          const c = d.collection(name);
          return {
            createIndex: async (...a: Parameters<typeof c.createIndex>) => {
              try {
                return await c.createIndex(...a);
              } catch (e) {
                const err = e as { code?: number; message?: string };
                const kind = err.code === 85 || err.code === 86 ? "index conflict" : "index error";
                console.warn(`[db] ${kind} on ${name}: ${scrub(String(err.message ?? e)).slice(0, 200)}`);
                return "";
              }
            },
          };
        }) as unknown as IndexDb["collection"],
      };
      await createIndexes(lenient);
    } catch (e) {
      console.warn(`[db] ensureIndexes failed: ${scrub(String((e as Error)?.message ?? e)).slice(0, 200)}`);
    }
  })();
  memo.set(key, run);
  return run;
}

async function createIndexes(d: IndexDb) {
  await d.collection("billing_accounts").createIndex({ app: 1, stripeCustomerId: 1 }, { unique: true, partialFilterExpression: { stripeCustomerId: { $type: "string" } } });
  await d.collection("disputes").createIndex({ app: 1, orgId: 1 });
  await d.collection("stripe_events").createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("rate_limits").createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("usage").createIndex({ app: 1, orgId: 1, period: 1 });
  await d.collection("audit_log").createIndex({ app: 1, orgId: 1, at: -1 });
  await d.collection("webhook_endpoints").createIndex({ app: 1, orgId: 1 });
  await d.collection("webhook_deliveries").createIndex({ app: 1, orgId: 1, createdAt: -1 });
  await d.collection("webhook_deliveries").createIndex({ app: 1, status: 1, nextAttemptAt: 1 });
  await d.collection("webhook_deliveries").createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("suppressions").createIndex({ app: 1, email: 1 });
  // M2 job database. Quiz counts and the matches list are served from these (ARCHITECTURE section 3).
  await d.collection("employers").createIndex({ app: 1, status: 1, suppressed: 1, nextCrawlAt: 1 });
  await d.collection("employers").createIndex({ app: 1, ats: 1, slug: 1 }, { unique: true });
  await d.collection("jobs").createIndex({ app: 1, closedAt: 1, field: 1, country: 1, agencyFlag: 1, postedAt: -1 });
  await d.collection("jobs").createIndex({ app: 1, employerId: 1, externalId: 1 }, { unique: true });
  await d.collection("jobs").createIndex({ app: 1, employerId: 1, closedAt: 1 });
  await d.collection("jobs").createIndex({ app: 1, dedupeKey: 1 });
  await d.collection("jobs").createIndex({ app: 1, firstSeenAt: -1 });
  await d.collection("crawl_leases").createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("source_runs").createIndex({ app: 1, startedAt: -1 });
  await d.collection("source_runs").createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("job_opens").createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("saved_jobs").createIndex({ app: 1, orgId: 1, savedAt: -1 });
  await d.collection("jobs").createIndex({ app: 1, agencyFlag: 1, closedAt: 1, postedAt: -1 });
  await d.collection("labels").createIndex({ app: 1, at: -1 });
  await d.collection("reminders").createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("entitlements").createIndex({ app: 1, isPaid: 1 });
  await d.collection("search_profiles").createIndex({ app: 1, digest: 1 });
  await d.collection("search_profiles").createIndex({ app: 1, alerts: 1 });
  await d.collection("alert_rules").createIndex({ app: 1, orgId: 1, createdAt: 1 });
  await d.collection("alert_rules").createIndex({ app: 1, active: 1 });
  await d.collection("alert_rules").createIndex({ app: 1, email: 1 });
  await d.collection("source_runs").createIndex({ app: 1, finishedAt: 1 });
  // Better Auth collections
  await d.collection("user").createIndex({ email: 1 }, { unique: true });
  await d.collection("session").createIndex({ token: 1 }, { unique: true });
  await d.collection("session").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("verification").createIndex({ identifier: 1 });
  await d.collection("verification").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("member").createIndex({ organizationId: 1, userId: 1 }, { unique: true });
  await d.collection("organization").createIndex({ slug: 1 }, { unique: true });
  await d.collection("apikey").createIndex({ key: 1 });
  return DELIVERY_TTL_DAYS;
}
