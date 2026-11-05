import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/types";
import { NONE } from "@/lib/billing/entitlement";
import { fixtureJobs, NOW } from "@/lib/jobs/fixtures";
import type { SearchProfile } from "@/lib/jobs/types";

// Shared contract suite (ported from trayo server/__tests__/dbContract.ts, sync/family/merge removed).
// Run against memory always, and against Mongo when MONGODB_URI_TEST is set.
export function dbContract(name: string, make: () => Promise<Db>) {
  describe(`Db contract: ${name}`, () => {
    it("billing accounts are found by Stripe customer", async () => {
      const db = await make();
      await db.upsertBillingAccount({ id: "org_a", stripeCustomerId: "cus_1", email: "a@x.test" });
      expect((await db.findBillingAccountByCustomer("cus_1"))?.id).toBe("org_a");
      expect(await db.findBillingAccountByCustomer("cus_nope")).toBeNull();
      expect((await db.getBillingAccount("org_a"))?.createdAt).toBeInstanceOf(Date);
    });

    it("entitlements round trip", async () => {
      const db = await make();
      const e = { ...NONE(1), isPaid: true, status: "active" as const, plan: "monthly" as const };
      await db.setEntitlement("org_e", e);
      expect(await db.getEntitlement("org_e")).toEqual(e);
    });

    it("stripe events: recorded only via markStripeEvent, once", async () => {
      const db = await make();
      const id = `evt_${Math.random()}`;
      expect(await db.hasStripeEvent(id)).toBe(false);
      expect(await db.markStripeEvent(id, "x")).toBe(true);
      expect(await db.markStripeEvent(id, "x")).toBe(false);
      expect(await db.hasStripeEvent(id)).toBe(true);
    });

    it("usage counters increment atomically per period", async () => {
      const db = await make();
      const org = `org_u${Math.random()}`;
      expect(await db.incUsage(org, "submissions", "2026-11")).toBe(1);
      expect(await db.incUsage(org, "submissions", "2026-11", 4)).toBe(5);
      expect(await db.getUsage(org, "submissions", "2026-12")).toBe(0);
    });

    it("sliding-window rate limit drops old hits", async () => {
      const db = await make();
      const k = `rl_${Math.random()}`;
      expect(await db.hitRateLimit(k, 1000, 10_000)).toBe(1);
      expect(await db.hitRateLimit(k, 1000, 10_500)).toBe(2);
      expect(await db.hitRateLimit(k, 1000, 11_200)).toBe(2); // the 10_000 hit fell out
    });

    it("audit log is append-only and ordered newest first", async () => {
      const db = await make();
      const org = `org_${Math.random()}`;
      await db.appendAudit({ orgId: org, actorId: "u1", action: "a.one", at: new Date(1000) });
      await db.appendAudit({ orgId: org, actorId: "u1", action: "a.two", at: new Date(2000) });
      const list = await db.listAudit(org);
      expect(list.map((x) => x.action)).toEqual(["a.two", "a.one"]);
      expect((await db.listAudit(org, { before: new Date(1500) })).map((x) => x.action)).toEqual(["a.one"]);
    });

    it("webhook endpoints are scoped to their org; due deliveries are found", async () => {
      const db = await make();
      const org = `org_${Math.random()}`;
      await db.createWebhookEndpoint({ id: `ep_${org}`, orgId: org, url: "https://x.test/h", secret: "whsec_1", events: ["*"], enabled: true });
      expect(await db.getWebhookEndpoint("someone_else", `ep_${org}`)).toBeNull();
      const now = new Date();
      await db.createDelivery({
        id: `d_${org}`, orgId: org, endpointId: `ep_${org}`, event: "x", payload: "{}", status: "retrying", attempts: 1,
        nextAttemptAt: new Date(now.getTime() - 1000), lastStatusCode: 500, lastError: "http_500", createdAt: now, updatedAt: now,
        expireAt: new Date(now.getTime() + 864e5),
      });
      expect((await db.dueDeliveries(now, 10)).some((d) => d.id === `d_${org}`)).toBe(true);
      expect((await db.getDelivery(org, `d_${org}`))?.expireAt).toBeInstanceOf(Date); // TTL field is a Date
    });

    it("suppression list: all-scope blocks every scope", async () => {
      const db = await make();
      const e = `User${Math.random()}@X.test`;
      await db.addSuppression({ email: e, scope: "marketing", reason: "unsubscribe" });
      expect(await db.isSuppressed(e.toLowerCase(), "marketing")).toBe(true);
      expect(await db.isSuppressed(e, "notification")).toBe(false);
      await db.addSuppression({ email: e, scope: "all", reason: "complaint" });
      expect(await db.isSuppressed(e, "notification")).toBe(true);
    });

    it("deleteOrgData removes billing + webhooks but keeps the audit log", async () => {
      const db = await make();
      const org = `org_${Math.random()}`;
      await db.upsertBillingAccount({ id: org, stripeCustomerId: `cus_${org}`, email: null });
      await db.setEntitlement(org, NONE(1));
      await db.createWebhookEndpoint({ id: `ep2_${org}`, orgId: org, url: "https://x.test", secret: "s", events: ["*"], enabled: true });
      await db.appendAudit({ orgId: org, actorId: null, action: "x" });
      const exported = await db.exportOrgData(org);
      expect(JSON.stringify(exported)).not.toContain('"secret"');
      await db.deleteOrgData(org);
      expect(await db.getBillingAccount(org)).toBeNull();
      expect(await db.getEntitlement(org)).toBeNull();
      expect(await db.listWebhookEndpoints(org)).toEqual([]);
      expect((await db.listAudit(org)).length).toBe(1);
    });

    it("employers: insert only upsert, due list, leases are exclusive and expire", async () => {
      const db = await make();
      const slug = `acme${Math.random().toString(36).slice(2, 8)}`;
      expect(await db.upsertEmployer({ name: "Acme", ats: "greenhouse", slug }, NOW, true)).toBe(true);
      expect(await db.upsertEmployer({ name: "Renamed", ats: "greenhouse", slug }, NOW)).toBe(false);
      const id = `greenhouse:${slug}`;
      expect((await db.getEmployer(id))?.name).toBe("Acme");
      expect((await db.dueEmployers(NOW, 10)).some((e) => e.id === id)).toBe(true);
      await db.patchEmployer(id, { nextCrawlAt: new Date(NOW.getTime() + 3_600_000) });
      expect((await db.dueEmployers(NOW, 10)).some((e) => e.id === id)).toBe(false);

      expect(await db.tryLease(id, "a", NOW, 1000)).toBe(true);
      expect(await db.tryLease(id, "b", new Date(NOW.getTime() + 500), 1000)).toBe(false);
      expect(await db.tryLease(id, "b", new Date(NOW.getTime() + 1500), 1000)).toBe(true); // a's lease expired
      await db.releaseLease(id, "a"); // not the owner: no effect
      expect(await db.tryLease(id, "a", new Date(NOW.getTime() + 1600), 1000)).toBe(false);
      await db.releaseLease(id, "b");
      expect(await db.tryLease(id, "a", new Date(NOW.getTime() + 1600), 1000)).toBe(true);
    });

    it("jobs: upsert is idempotent, keeps firstSeenAt, closes after 2 misses and reopens", async () => {
      const db = await make();
      const jobs = fixtureJobs(NOW).map((j) => ({ ...j, employerId: "greenhouse:contract", id: `c_${j.id}` }));
      const t1 = new Date(NOW.getTime());
      const r1 = await db.upsertJobs(jobs, t1);
      expect(r1).toEqual({ inserted: jobs.length, updated: 0 });
      const t2 = new Date(NOW.getTime() + 3_600_000);
      expect(await db.upsertJobs(jobs, t2)).toEqual({ inserted: 0, updated: jobs.length });
      const j0 = (await db.getJob(jobs[0]!.id))!;
      expect(j0.firstSeenAt.getTime()).toBe(t1.getTime());
      expect(j0.lastSeenAt.getTime()).toBe(t2.getTime());
      expect(j0.postedAt.getTime()).toBe(j0.firstPublishedAt!.getTime());
      // a job without a company date sorts by first seen
      const undated = (await db.getJob(jobs[jobs.length - 1]!.id))!;
      expect(undated.firstPublishedAt).toBeNull();
      expect(undated.postedAt.getTime()).toBe(t1.getTime());

      const keep = jobs.slice(1).map((j) => j.externalId);
      expect(await db.closeMissing("greenhouse:contract", keep, t2)).toBe(0); // first miss
      expect((await db.getJob(jobs[0]!.id))!.closedAt).toBeNull();
      expect(await db.closeMissing("greenhouse:contract", keep, t2)).toBe(1); // second miss closes
      expect((await db.getJob(jobs[0]!.id))!.closedAt).not.toBeNull();
      await db.upsertJobs([jobs[0]!], t2);
      expect((await db.getJob(jobs[0]!.id))!.closedAt).toBeNull();
      expect(await db.closeByExternalIds("greenhouse:contract", [jobs[0]!.externalId], t2)).toBe(1);
    });

    it("jobs: queries filter, hide agency posts, count and sort newest first", async () => {
      const db = await make();
      await db.upsertJobs(fixtureJobs(NOW).map((j) => ({ ...j, id: `q_${j.id}`, employerId: "greenhouse:queries" })), NOW);
      const support = await db.queryJobs({ field: "support", country: "US", limit: 50 });
      expect(support.every((j) => j.field === "support" && j.agencyFlag !== "yes")).toBe(true);
      expect(support.map((j) => j.title)).not.toContain("Customer Service Representative");
      const times = support.map((j) => j.postedAt.getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
      expect(await db.countJobs({ field: "support", country: "US" })).toBe(support.length);
      expect(await db.countAgencyHidden({ field: "support", country: "US" })).toBe(1);
      const remote = await db.countJobs({ field: "support", country: "US", remoteTypes: ["remote"] });
      expect(remote).toBeLessThan(support.length);
      // a pay floor keeps jobs with no pay shown, drops lower paid ones
      const floor = await db.queryJobs({ field: "support", country: "US", payFloor: 18, limit: 50 });
      expect(floor.every((j) => j.payHourlyMax === null || j.payHourlyMax >= 18)).toBe(true);
      expect(await db.countJobs({ field: "support", firstSeenAfter: new Date(NOW.getTime() + 1) })).toBe(0);
      expect((await db.queryJobs({ field: "support", limit: 2, skip: 1 })).length).toBe(2);
    });

    it("opens, saves and profiles", async () => {
      const db = await make();
      const org = `org_j${Math.random()}`;
      expect(await db.recordOpen(org, "2026-11-05", "j1")).toBe(true);
      expect(await db.recordOpen(org, "2026-11-05", "j1")).toBe(false);
      expect(await db.hasOpened(org, "2026-11-06", "j1")).toBe(false);
      expect(await db.saveJob(org, "j1", NOW)).toBe(true);
      expect(await db.saveJob(org, "j1", NOW)).toBe(false);
      expect((await db.listSaved(org)).map((s) => s.jobId)).toEqual(["j1"]);
      expect(await db.unsaveJob(org, "j1")).toBe(true);
      const p: SearchProfile = { orgId: org, email: "a@x.test", field: "support", country: "US", remote: "remote", payFloor: 20, level: "any", schedule: "any", tz: "America/New_York", digest: true, alerts: false, lastDigestAt: null, lastAlertAt: null, updatedAt: NOW };
      await db.saveProfile(p);
      expect(await db.getProfile(org)).toEqual(p);
      expect((await db.listProfiles({ digest: true })).some((x) => x.orgId === org)).toBe(true);
      expect((await db.listProfiles({ alerts: true })).some((x) => x.orgId === org)).toBe(false);
      await db.deleteOrgData(org);
      expect(await db.getProfile(org)).toBeNull();
    });

    it("source runs list newest first", async () => {
      const db = await make();
      const mk = (id: string, at: number) => ({ id, kind: "crawl-tick" as const, startedAt: new Date(at), finishedAt: new Date(at + 1), employers: 1, jobsSeen: 2, inserted: 2, updated: 0, closed: 0, agencyHidden: 0, errors: [], budgetHit: false });
      await db.recordSourceRun(mk(`r1_${Math.random()}`, 1000));
      const id2 = `r2_${Math.random()}`;
      await db.recordSourceRun(mk(id2, 2000));
      expect((await db.listSourceRuns(1))[0]!.id).toBe(id2);
    });

    it("config round trip", async () => {
      const db = await make();
      await db.setConfig("payments_enabled", "off");
      expect((await db.getConfig()).payments_enabled).toBe("off");
    });
  });
}
