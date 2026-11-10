import { beforeEach, describe, expect, it } from "vitest";
import { product } from "@/config/product";
import { clearPriceCache } from "@/lib/billing/catalog";
import { createCheckoutSession } from "@/lib/billing/checkout";
import { effectivePlan } from "@/lib/billing/entitlement";
import { cancelAtPeriodEnd, refundEligibility, refundLatestCharge } from "@/lib/billing/lifecycle";
import { ANNUAL_REMINDER_LEAD_DAYS, reminderDue, runRenewalReminders } from "@/lib/billing/reminders";
import { handleStripeWebhook } from "@/lib/billing/webhook";
import { labelGate, reviewJob } from "@/lib/classify/labels";
import { createMemoryDb } from "@/lib/db/memory";
import type { Db, Entitlement, LabelDoc } from "@/lib/db/types";
import { crawlHealth } from "@/lib/jobs/health";
import { fixtureJobs, NOW as JOBS_NOW } from "@/lib/jobs/fixtures";
import type { EmployerDoc, SourceRun } from "@/lib/jobs/types";
import type { MailMessage } from "@/lib/mail";
import { safeFrom } from "@/lib/safe-from";
import { event, fakeStripe } from "./fakes";

const NOW = 1_800_000_000_000;
const SEC = NOW / 1000;
const subject = { orgId: "org_1", email: "dana@studio.test", userId: "u_1" };
const urls = { success: "https://app.test/account?checkout=success", cancel: "https://app.test/paywall" };

let db: Db;
let f: ReturnType<typeof fakeStripe>;
beforeEach(() => {
  db = createMemoryDb("straightpin");
  f = fakeStripe(() => SEC);
  clearPriceCache();
});
const hook = (body: string) => handleStripeWebhook(body, "good", { stripe: f.stripe, db, secret: "whsec_x", now: () => NOW });
const customerFor = async (orgId = "org_1", email = "dana@studio.test") => {
  await db.upsertBillingAccount({ id: orgId, stripeCustomerId: `cus_${orgId}`, email });
  f.customers.set(`cus_${orgId}`, { id: `cus_${orgId}`, metadata: { app: "straightpin" }, email });
  return `cus_${orgId}`;
};

describe("Lifetime cap (atomic counter)", () => {
  const fill = async (n: number) => { for (let i = 0; i < n; i++) await db.claimLifetime(`buyer_${i}`, product.lifetimeCap); };

  it("two concurrent claims at 999 sold: exactly one gets the last slot", async () => {
    await fill(999);
    expect(await db.lifetimeSold()).toBe(999);
    const [a, b] = await Promise.all([db.claimLifetime("late_a", product.lifetimeCap), db.claimLifetime("late_b", product.lifetimeCap)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(await db.lifetimeSold()).toBe(1000);
  });

  it("re-claiming is free, release gives the slot back, and the 1,001st is sold out", async () => {
    await fill(1000);
    expect((await db.claimLifetime("buyer_5", product.lifetimeCap)).ok).toBe(true); // already holds one
    expect(await db.lifetimeSold()).toBe(1000);
    expect((await db.claimLifetime("newcomer", product.lifetimeCap)).ok).toBe(false);
    await db.releaseLifetime("buyer_5");
    expect((await db.claimLifetime("newcomer", product.lifetimeCap)).ok).toBe(true);
  });

  it("checkout refuses with lifetime_sold_out and creates no Stripe session", async () => {
    await fill(1000);
    await expect(createCheckoutSession(f.stripe, db, subject, "lifetime", "once", urls)).rejects.toMatchObject({ status: 409, code: "lifetime_sold_out" });
    expect(f.calls.some((c) => c.method === "checkout.sessions.create")).toBe(false);
  });

  it("checkout holds a slot with a short expiry; an expired session gives it back", async () => {
    const r = await createCheckoutSession(f.stripe, db, subject, "lifetime", "once", urls);
    expect(r.url).toContain("checkout.stripe.test");
    const call = f.calls.find((c) => c.method === "checkout.sessions.create")!.args as Record<string, any>;
    expect(call.mode).toBe("payment");
    expect(call.expires_at).toBeGreaterThan(Date.now() / 1000);
    expect(await db.lifetimeSold()).toBe(1);
    const cus = (await db.getBillingAccount("org_1"))!.stripeCustomerId!;
    await hook(event("checkout.session.expired", { customer: cus, metadata: { app: "straightpin", mode: "lifetime" } }));
    expect(await db.lifetimeSold()).toBe(0);
  });
});

describe("entitlement from each event", () => {
  it.each([
    ["checkout.session.completed", "straightpin_monthly_month", "active", true, "monthly"],
    ["customer.subscription.created", "straightpin_weekly_week", "active", true, "weekly"],
    ["customer.subscription.updated", "straightpin_plus_year", "active", true, "plus"],
    ["invoice.paid", "straightpin_plus_month", "active", true, "plus"],
    ["invoice.payment_failed", "straightpin_monthly_month", "past_due", true, "monthly"],
    ["customer.subscription.deleted", "straightpin_monthly_month", "canceled", false, "free"],
  ])("%s with a %s subscription -> %s", async (type, key, status, paid, plan) => {
    const cus = await customerFor();
    f.addSub(cus, key, status as string);
    expect((await hook(event(type as string, { customer: cus }))).status).toBe(200);
    expect(await db.getEntitlement("org_1")).toMatchObject({ isPaid: paid, status, plan });
  });

  it("payment_intent.succeeded for Lifetime grants Lifetime and holds a slot", async () => {
    const cus = await customerFor();
    await hook(event("payment_intent.succeeded", { id: "pi_life", customer: cus, metadata: { app: "straightpin", mode: "lifetime", lookup_key: "straightpin_lifetime_once" } }));
    const e = await db.getEntitlement("org_1");
    expect(e).toMatchObject({ isPaid: true, status: "lifetime", plan: "lifetime", lifetimePaymentIntentId: "pi_life" });
    expect(effectivePlan(e, NOW + 5 * 365 * 864e5).id).toBe("lifetime"); // never expires
    expect(await db.lifetimeSold()).toBe(1);
  });

  it("another app's payment intent grants nothing", async () => {
    const cus = await customerFor();
    await hook(event("payment_intent.succeeded", { id: "pi_x", customer: cus, metadata: { app: "otherapp", mode: "lifetime", lookup_key: "straightpin_lifetime_once" } }));
    expect(await db.getEntitlement("org_1")).toBeNull();
  });

  it("a full refund of the Lifetime payment turns it off and frees the slot; a partial one does not", async () => {
    const cus = await customerFor();
    await hook(event("payment_intent.succeeded", { id: "pi_life", customer: cus, metadata: { app: "straightpin", mode: "lifetime", lookup_key: "straightpin_lifetime_once" } }));
    await hook(event("charge.refunded", { customer: cus, refunded: false, payment_intent: "pi_life" }));
    expect((await db.getEntitlement("org_1"))?.status).toBe("lifetime");
    await hook(event("charge.refunded", { customer: cus, refunded: true, payment_intent: "pi_life" }));
    expect(await db.getEntitlement("org_1")).toMatchObject({ isPaid: false, plan: "free" });
    expect(await db.lifetimeSold()).toBe(0);
  });

  it("a full refund of a subscription charge cancels it and ends the plan", async () => {
    const cus = await customerFor();
    f.addSub(cus, "straightpin_monthly_month");
    await hook(event("invoice.paid", { customer: cus }));
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(true);
    await hook(event("charge.refunded", { customer: cus, refunded: true, payment_intent: "pi_s" }));
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(false);
    expect(f.calls.some((c) => c.method === "subscriptions.cancel")).toBe(true);
  });
});

describe("cancel", () => {
  it("sets cancel at period end, keeps the plan on, and audits", async () => {
    const cus = await customerFor();
    const sub = f.addSub(cus, "straightpin_monthly_month");
    await hook(event("invoice.paid", { customer: cus }));
    const log: string[] = [];
    const ent = await cancelAtPeriodEnd({ stripe: f.stripe, db, now: () => NOW, audit: async (e) => { log.push(e.action); } }, "org_1", "u_1");
    expect(sub.cancel_at_period_end).toBe(true);
    expect(ent).toMatchObject({ isPaid: true, cancelAtPeriodEnd: true, plan: "monthly" });
    expect(log).toEqual(["billing.cancel_requested"]);
  });

  it("nothing to cancel on Free or Lifetime", async () => {
    await customerFor();
    await expect(cancelAtPeriodEnd({ stripe: f.stripe, db }, "org_1", "u_1")).rejects.toMatchObject({ code: "nothing_to_cancel" });
  });
});

describe("refund (once per customer, 7 days)", () => {
  const paidMonthly = async (chargedSecAgo = 3600) => {
    const cus = await customerFor();
    f.addSub(cus, "straightpin_monthly_month");
    f.addCharge(cus, 1099, SEC - chargedSecAgo);
    await hook(event("invoice.paid", { customer: cus }));
    return cus;
  };
  const deps = (sent: MailMessage[], log: string[] = []) => ({
    stripe: f.stripe, db, now: () => NOW,
    send: async (m: MailMessage) => { sent.push(m); },
    audit: async (e: { action: string }) => { log.push(e.action); },
  });

  it("refunds the latest charge, turns the plan off, audits and emails", async () => {
    await paidMonthly();
    const sent: MailMessage[] = [];
    const log: string[] = [];
    const r = await refundLatestCharge(deps(sent, log), "org_1", { id: "u_1", by: "self" });
    expect(r.amount).toBe(1099);
    expect(f.refunds).toHaveLength(1);
    expect(await db.getEntitlement("org_1")).toMatchObject({ isPaid: false, plan: "free" });
    expect(log).toEqual(["billing.refunded"]);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "dana@studio.test", category: "transactional" });
    expect(sent[0]!.subject).toContain("$10.99");
  });

  it("only once: a second refund is refused and Stripe is not called again", async () => {
    const cus = await paidMonthly();
    await refundLatestCharge(deps([]), "org_1", { id: "u_1", by: "self" });
    // the customer pays again later
    f.addSub(cus, "straightpin_monthly_month");
    f.addCharge(cus, 1099, SEC - 60);
    await hook(event("invoice.paid", { customer: cus }));
    await expect(refundLatestCharge(deps([]), "org_1", { id: "u_1", by: "self" })).rejects.toMatchObject({ status: 409, code: "refund_already_used" });
    expect(f.refunds).toHaveLength(1);
    expect(await refundEligibility(f.stripe, db, "org_1", NOW)).toMatchObject({ eligible: false, reason: "used" });
  });

  it("two simultaneous taps refund once", async () => {
    await paidMonthly();
    const res = await Promise.allSettled([refundLatestCharge(deps([]), "org_1", { id: "u_1", by: "self" }), refundLatestCharge(deps([]), "org_1", { id: "u_1", by: "self" })]);
    expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(f.refunds).toHaveLength(1);
  });

  it("outside 7 days: refused for the customer, allowed for an admin (still once)", async () => {
    await paidMonthly(8 * 86400);
    expect(await refundEligibility(f.stripe, db, "org_1", NOW)).toMatchObject({ eligible: false, reason: "window" });
    await expect(refundLatestCharge(deps([]), "org_1", { id: "u_1", by: "self" })).rejects.toMatchObject({ code: "refund_window_closed" });
    expect(f.refunds).toHaveLength(0);
    await refundLatestCharge(deps([]), "org_1", { id: "admin_1", by: "admin" });
    expect(f.refunds).toHaveLength(1);
    expect((await db.getRefund("cus_org_1"))?.by).toBe("admin");
  });

  it("a Stripe failure gives the refund back so the customer can retry", async () => {
    await paidMonthly();
    f.failRefund.on = true;
    await expect(refundLatestCharge(deps([]), "org_1", { id: "u_1", by: "self" })).rejects.toMatchObject({ code: "refund_failed" });
    expect(await db.getRefund("cus_org_1")).toBeNull();
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(true);
    f.failRefund.on = false;
    await refundLatestCharge(deps([]), "org_1", { id: "u_1", by: "self" });
    expect(f.refunds).toHaveLength(1);
  });

  it("refunding Lifetime frees the slot; Free accounts have nothing to refund", async () => {
    const cus = await customerFor();
    await expect(refundLatestCharge(deps([]), "org_1", { id: "u_1", by: "self" })).rejects.toMatchObject({ code: "nothing_to_refund" });
    await hook(event("payment_intent.succeeded", { id: "pi_life", customer: cus, metadata: { app: "straightpin", mode: "lifetime", lookup_key: "straightpin_lifetime_once" } }));
    f.addCharge(cus, 2399, SEC - 100);
    await refundLatestCharge(deps([]), "org_1", { id: "u_1", by: "self" });
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(false);
    expect(await db.lifetimeSold()).toBe(0);
  });
});

describe("renewal reminders", () => {
  const ent = (over: Partial<Entitlement>): Entitlement => ({
    isPaid: true, status: "active", plan: "monthly", interval: "month", expiresAt: NOW + 2 * 864e5, trialStartedAt: null, cancelAtPeriodEnd: false,
    checkedAt: NOW, trialUsed: true, subscriptionId: "sub_1", lifetimePaymentIntentId: null, pastDueSince: null, ...over,
  });

  it("weekly and monthly: due from 3 days before the renewal, not earlier, not after", () => {
    expect(reminderDue(ent({ interval: "month", expiresAt: NOW + 3 * 864e5 }), NOW)).toBe(true);
    expect(reminderDue(ent({ interval: "month", expiresAt: NOW + 3 * 864e5 + 1 }), NOW)).toBe(false);
    expect(reminderDue(ent({ interval: "week", plan: "weekly", expiresAt: NOW + 864e5 }), NOW)).toBe(true);
    expect(reminderDue(ent({ interval: "week", plan: "weekly", expiresAt: NOW - 1 }), NOW)).toBe(false);
  });

  it("annual: due from 21 days before the renewal, never later than 14 days ahead, not earlier", () => {
    const y = (days: number) => ent({ plan: "plus", interval: "year", expiresAt: NOW + days * 864e5 });
    expect(reminderDue(y(22), NOW)).toBe(false);
    expect(reminderDue(y(21), NOW)).toBe(true);
    expect(reminderDue(y(15), NOW)).toBe(true);
    expect(reminderDue(y(0.5), NOW)).toBe(true); // a late catch-up still sends before the renewal
    expect(reminderDue(ent({ plan: "plus", interval: "year", expiresAt: NOW - 1 }), NOW)).toBe(false);
    expect(ANNUAL_REMINDER_LEAD_DAYS).toBeGreaterThanOrEqual(14);
  });

  it("Plus stays off sale while annual reminders change", () => {
    expect(product.plans.find((x) => x.id === "plus")?.onSale).toBe(false);
  });

  it("never for cancelling, past due, lifetime or free", () => {
    expect(reminderDue(ent({ cancelAtPeriodEnd: true }), NOW)).toBe(false);
    expect(reminderDue(ent({ status: "past_due" }), NOW)).toBe(false);
    expect(reminderDue(ent({ status: "lifetime", interval: "once" }), NOW)).toBe(false);
    expect(reminderDue(ent({ isPaid: false, status: "none" }), NOW)).toBe(false);
  });

  it("the cron sends one email per renewal with an unsubscribe link, skips suppressed and repeats", async () => {
    await db.upsertBillingAccount({ id: "o1", stripeCustomerId: "c1", email: "a@x.test" });
    await db.upsertBillingAccount({ id: "o2", stripeCustomerId: "c2", email: "b@x.test" });
    await db.upsertBillingAccount({ id: "o3", stripeCustomerId: "c3", email: "c@x.test" });
    await db.setEntitlement("o1", ent({}));
    await db.setEntitlement("o2", ent({}));
    await db.setEntitlement("o3", ent({ expiresAt: NOW + 20 * 864e5 })); // not yet
    await db.addSuppression({ email: "b@x.test", scope: "renewals", reason: "unsubscribe" });
    const sent: MailMessage[] = [];
    const run = () => runRenewalReminders(db, new Date(NOW), async (m) => { sent.push(m); }, async (e, s) => `https://app.test/unsub?e=${e}&s=${s}`);
    expect(await run()).toEqual({ considered: 3, sent: 1, skipped: 2, failed: 0 });
    expect(sent[0]).toMatchObject({ to: "a@x.test", category: "renewals" });
    expect(sent[0]!.text).toContain("unsub?e=a@x.test&s=renewals");
    expect(sent[0]!.text).toContain("$10.99 per month");
    expect(sent[0]!.subject).toContain("Monthly renews on");
    expect(await run()).toMatchObject({ sent: 0 }); // same renewal date: no second email
    await db.setEntitlement("o1", ent({ expiresAt: NOW + 2.5 * 864e5 })); // renewed, next period
    expect((await run()).sent).toBe(1);
  });
});

describe("review labels and the training gate", () => {
  const seedPending = async () => {
    const jobs = fixtureJobs(JOBS_NOW).slice(0, 2).map((j, i) => ({ ...j, agencyFlag: "pending" as const, agencyScore: 0.5 + i / 100 }));
    await db.upsertJobs(jobs, JOBS_NOW);
    return jobs;
  };

  it("confirm writes an agency label and hides the job; reject writes direct and shows it", async () => {
    const [a, b] = await seedPending();
    expect((await db.listPendingAgency(10)).map((j) => j.id).sort()).toEqual([a!.id, b!.id].sort());
    const jobA = (await db.getJob(a!.id))!;
    const jobB = (await db.getJob(b!.id))!;
    const la = await reviewJob(db, jobA, "agency", "founder@x.test", JOBS_NOW);
    await reviewJob(db, jobB, "direct", "founder@x.test", JOBS_NOW);
    expect(la).toMatchObject({ jobId: a!.id, label: "agency", by: "founder@x.test" });
    expect(la.input).toMatchObject({ title: jobA.title, company: jobA.employerName, applyHost: jobA.sourceHost });
    expect(await db.getJob(a!.id)).toMatchObject({ agencyFlag: "yes", agencyScore: 1 });
    expect(await db.getJob(b!.id)).toMatchObject({ agencyFlag: "no", agencyScore: 0 });
    expect(await db.listPendingAgency(10)).toHaveLength(0);
    expect((await db.listLabels()).map((l) => l.label).sort()).toEqual(["agency", "direct"]);
  });

  it("a second review of the same job replaces the first label (latest wins)", async () => {
    const [a] = await seedPending();
    const job = (await db.getJob(a!.id))!;
    await reviewJob(db, job, "agency", "x", JOBS_NOW);
    await reviewJob(db, job, "direct", "x", new Date(JOBS_NOW.getTime() + 1000));
    const labels = await db.listLabels();
    expect(labels).toHaveLength(1);
    expect(labels[0]!.label).toBe("direct");
  });

  it("the gate stays off with too few labels and reports the counts", () => {
    const mk = (i: number, label: LabelDoc["label"]): LabelDoc => ({ jobId: `j${i}`, label, by: "x", at: new Date(0), input: { title: label === "agency" ? "Recruiter staffing" : "Support", company: `c${i}`, excerpt: "x" } });
    const g = labelGate([mk(1, "agency"), mk(2, "direct")]);
    expect(g).toMatchObject({ labelled: 2, agency: 1, direct: 1, metrics: null, passes: false });
  });

  it("with enough clearly separable labels the gate runs on a held out set", () => {
    const labels: LabelDoc[] = [];
    for (let i = 0; i < 320; i++) {
      const agency = i % 2 === 0;
      labels.push({
        jobId: `j${String(i).padStart(4, "0")}`, label: agency ? "agency" : "direct", by: "x", at: new Date(0),
        input: agency
          ? { title: "Recruitment consultant", company: `Talent Staffing Solutions ${i % 7}`, excerpt: "On behalf of our client, a staffing agency role. Apply to our recruiter.", applyHost: "recruiter.example" }
          : { title: "Support specialist", company: `Acme Software ${i % 7}`, excerpt: "Join our product team and help our customers every day.", applyHost: "boards.greenhouse.io" },
      });
    }
    const g = labelGate(labels);
    expect(g.metrics).not.toBeNull();
    expect(g.metrics!.n).toBe(64);
    expect(g.metrics!.precision).toBeGreaterThan(0.9);
  });
});

describe("crawl health", () => {
  const emp = (id: string): EmployerDoc => ({ id, name: id, ats: "greenhouse", slug: id, status: "active", failCount: 0, lastCrawledAt: null, nextCrawlAt: new Date(0), suppressed: false, seed: true });
  const run = (t: number, boards: SourceRun["boards"], errors: SourceRun["errors"] = []): SourceRun => ({
    id: `r${t}`, kind: "crawl-tick", startedAt: new Date(t), finishedAt: new Date(t + 1), employers: boards!.length, jobsSeen: 0,
    inserted: boards!.reduce((n, b) => n + b.inserted, 0), updated: 0, closed: boards!.reduce((n, b) => n + b.closed, 0), agencyHidden: 0, errors, boards, budgetHit: false,
  });

  it("per source success rate, added and closed, worst first", () => {
    const h = crawlHealth([emp("a"), emp("b"), emp("c")], [
      run(1000, [{ employerId: "a", ok: true, inserted: 5, closed: 1 }, { employerId: "b", ok: false, inserted: 0, closed: 0 }], [{ employerId: "b", message: "HTTP 500" }]),
      run(2000, [{ employerId: "a", ok: true, inserted: 2, closed: 0 }, { employerId: "b", ok: true, inserted: 3, closed: 2 }]),
    ]);
    expect(h.sources.map((s) => s.employerId)).toEqual(["b", "a", "c"]);
    expect(h.sources[0]).toMatchObject({ runs: 2, ok: 1, successRate: 0.5, added: 3, closed: 2, lastError: "HTTP 500" });
    expect(h.sources[1]).toMatchObject({ successRate: 1, added: 7, closed: 1 });
    expect(h.sources[2]).toMatchObject({ successRate: null, runs: 0 });
    expect(h).toMatchObject({ runs: 2, added: 10, closed: 3, overallSuccessRate: 0.75 });
    expect(h.lastRunAt).toEqual(new Date(2000));
  });
});

describe("suspension and redirects", () => {
  it("suspend is per org and reversible", async () => {
    await db.setSuspended("org_1", true, "founder");
    expect(await db.isSuspended("org_1")).toBe(true);
    expect(await db.isSuspended("org_2")).toBe(false);
    await db.setSuspended("org_1", false, "founder");
    expect(await db.isSuspended("org_1")).toBe(false);
  });
  it("the paywall close button only goes to same site paths", () => {
    expect(safeFrom("/job/abc")).toBe("/job/abc");
    expect(safeFrom("https://evil.test")).toBe("/matches");
    expect(safeFrom("//evil.test")).toBe("/matches");
    expect(safeFrom("/\\evil.test")).toBe("/matches");
    expect(safeFrom(undefined)).toBe("/matches");
  });
  it("prices on the paywall come from product.ts", () => {
    const prices = product.plans.flatMap((p) => p.prices.map((x) => `${p.id}:${x.interval}`));
    expect(prices).toEqual(["weekly:week", "monthly:month", "lifetime:once", "plus:month", "plus:year"]);
    expect(product.defaultInterval).toBe("month");
  });
});
