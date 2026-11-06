import { beforeEach, describe, expect, it } from "vitest";
import { clearPriceCache } from "@/lib/billing/catalog";
import { firstRefundableCharge, refundEligibility, refundLatestCharge } from "@/lib/billing/lifecycle";
import { handleStripeWebhook } from "@/lib/billing/webhook";
import { createMemoryDb } from "@/lib/db/memory";
import type { Db } from "@/lib/db/types";
import { event, fakeStripe } from "./fakes";

// REVIEW P1-1 (disputes), P1-2 and P1-3 (refund rule), P1-6 (unsubscribe), P1-5 (health).

const NOW = 1_800_000_000_000;
const SEC = NOW / 1000;
let db: Db;
let f: ReturnType<typeof fakeStripe>;
let log: { action: string; target?: string | null }[];
beforeEach(() => {
  db = createMemoryDb("straightpin");
  f = fakeStripe(() => SEC);
  log = [];
  clearPriceCache();
});
const audit = async (e: { action: string; target?: string | null }) => { log.push(e); };
const hook = (body: string) => handleStripeWebhook(body, "good", { stripe: f.stripe, db, secret: "whsec_x", now: () => NOW, audit });
const customerFor = async (orgId = "org_1", email = "dana@studio.test") => {
  await db.upsertBillingAccount({ id: orgId, stripeCustomerId: `cus_${orgId}`, email });
  f.customers.set(`cus_${orgId}`, { id: `cus_${orgId}`, metadata: { app: "straightpin" }, email });
  return `cus_${orgId}`;
};
const deps = { get: () => ({ stripe: f.stripe, db, now: () => NOW, send: async () => undefined, audit }) };

const lifetime = async () => {
  const cus = await customerFor();
  await hook(event("payment_intent.succeeded", { id: "pi_life", customer: cus, metadata: { app: "straightpin", mode: "lifetime", lookup_key: "straightpin_lifetime_once" } }));
  const ch = f.addCharge(cus, 2399, SEC - 100);
  return { cus, ch };
};
const monthly = async () => {
  const cus = await customerFor();
  f.addSub(cus, "straightpin_monthly_month");
  const ch = f.addCharge(cus, 1099, SEC - 100);
  await hook(event("invoice.paid", { customer: cus }));
  return { cus, ch };
};
const dispute = (type: "charge.dispute.created" | "charge.dispute.closed", charge: string, status = "needs_response") =>
  event(type, { id: "dp_1", charge, status });

describe("P1-1 disputes", () => {
  it("opening a dispute turns off Lifetime, audits, and a later event cannot bring it back", async () => {
    const { ch } = await lifetime();
    expect((await db.getEntitlement("org_1"))?.status).toBe("lifetime");
    await hook(dispute("charge.dispute.created", ch.id));
    expect(await db.getEntitlement("org_1")).toMatchObject({ isPaid: false, status: "none" });
    expect(log.map((l) => l.action)).toContain("billing.dispute_opened");
    // a replayed payment event while the dispute is open must not restore it
    await hook(event("payment_intent.succeeded", { id: "pi_life", customer: "cus_org_1", metadata: { app: "straightpin", mode: "lifetime", lookup_key: "straightpin_lifetime_once" } }));
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(false);
  });

  it("opening a dispute turns off a subscription, even if the subscription event arrives afterwards", async () => {
    const { cus, ch } = await monthly();
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(true);
    await hook(dispute("charge.dispute.created", ch.id));
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(false);
    await hook(event("customer.subscription.updated", { customer: cus }));
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(false);
  });

  it("won: Lifetime comes back with its payment id", async () => {
    const { ch } = await lifetime();
    await hook(dispute("charge.dispute.created", ch.id));
    await hook(dispute("charge.dispute.closed", ch.id, "won"));
    expect(await db.getEntitlement("org_1")).toMatchObject({ isPaid: true, status: "lifetime", lifetimePaymentIntentId: "pi_life" });
    expect(log.map((l) => l.action)).toContain("billing.dispute_won");
  });

  it("won: a subscription is recomputed from Stripe and comes back", async () => {
    const { ch } = await monthly();
    await hook(dispute("charge.dispute.created", ch.id));
    await hook(dispute("charge.dispute.closed", ch.id, "won"));
    expect(await db.getEntitlement("org_1")).toMatchObject({ isPaid: true, plan: "monthly" });
  });

  it("lost: Lifetime stays off and its slot is freed", async () => {
    const { ch } = await lifetime();
    expect(await db.lifetimeSold()).toBe(1);
    await hook(dispute("charge.dispute.created", ch.id));
    await hook(dispute("charge.dispute.closed", ch.id, "lost"));
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(false);
    expect(await db.lifetimeSold()).toBe(0);
    expect(log.map((l) => l.action)).toContain("billing.dispute_lost");
  });

  it("lost: the subscription is cancelled and stays off", async () => {
    const { cus, ch } = await monthly();
    await hook(dispute("charge.dispute.created", ch.id));
    await hook(dispute("charge.dispute.closed", ch.id, "lost"));
    expect(f.subs.every((s) => s.status === "canceled")).toBe(true);
    await hook(event("customer.subscription.updated", { customer: cus }));
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(false);
  });

  it("a dispute on another app's customer is ignored", async () => {
    const ch = f.addCharge("cus_stranger", 999);
    await hook(dispute("charge.dispute.created", ch.id));
    expect(log).toHaveLength(0);
  });
});

describe("P1-3 the refund covers the first charge only", () => {
  it("refunds the first charge, not the newest, and is refused when the first is older than 7 days", async () => {
    const cus = await customerFor();
    f.addSub(cus, "straightpin_monthly_month");
    const first = f.addCharge(cus, 1099, SEC - 20 * 86400);
    f.addCharge(cus, 1099, SEC - 3600); // the renewal an hour ago
    await hook(event("invoice.paid", { customer: cus }));
    expect((await firstRefundableCharge(f.stripe, cus, "straightpin"))?.id).toBe(first.id);
    expect(await refundEligibility(f.stripe, db, "org_1", NOW)).toMatchObject({ eligible: false, reason: "window" });
    await expect(refundLatestCharge(deps.get(), "org_1", { id: "u_1", by: "self" })).rejects.toMatchObject({ code: "refund_window_closed" });
    expect(f.refunds).toHaveLength(0);
  });

  it("inside 7 days the first charge is the one refunded", async () => {
    const cus = await customerFor();
    f.addSub(cus, "straightpin_monthly_month");
    const first = f.addCharge(cus, 1099, SEC - 2 * 86400);
    f.addCharge(cus, 499, SEC - 3600);
    await hook(event("invoice.paid", { customer: cus }));
    const r = await refundLatestCharge(deps.get(), "org_1", { id: "u_1", by: "self" });
    expect(r.chargeId).toBe(first.id);
  });

  it("a Lifetime holder whose first charge was an older subscription payment gets no self refund", async () => {
    const cus = await customerFor();
    f.addCharge(cus, 499, SEC - 30 * 86400);
    await hook(event("payment_intent.succeeded", { id: "pi_life", customer: cus, metadata: { app: "straightpin", mode: "lifetime", lookup_key: "straightpin_lifetime_once" } }));
    f.addCharge(cus, 2399, SEC - 60);
    await expect(refundLatestCharge(deps.get(), "org_1", { id: "u_1", by: "self" })).rejects.toMatchObject({ code: "refund_window_closed" });
  });
});

describe("P1-2 no second refund after sign up again", () => {
  it("a new Stripe customer with the same verified email is refused, and only a hash is kept", async () => {
    await monthly();
    await refundLatestCharge(deps.get(), "org_1", { id: "u_1", by: "self" });
    // account deleted: billing account gone, refund tombstone stays
    const rec = await db.getRefund("cus_org_1");
    expect(rec?.emailHash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(rec)).not.toContain("dana@studio.test");
    // same person signs up again, new org, new Stripe customer, different letter case
    const cus2 = await customerFor("org_2", "Dana@Studio.test");
    f.addSub(cus2, "straightpin_monthly_month");
    f.addCharge(cus2, 1099, SEC - 60);
    await hook(event("invoice.paid", { customer: cus2 }));
    expect(await refundEligibility(f.stripe, db, "org_2", NOW)).toMatchObject({ eligible: false, reason: "used" });
    await expect(refundLatestCharge(deps.get(), "org_2", { id: "u_2", by: "self" })).rejects.toMatchObject({ status: 409, code: "refund_already_used" });
    expect(f.refunds).toHaveLength(1);
  });

  it("a different person is not blocked, and a Stripe failure frees the email key too", async () => {
    await monthly();
    f.failRefund.on = true;
    await expect(refundLatestCharge(deps.get(), "org_1", { id: "u_1", by: "self" })).rejects.toMatchObject({ code: "refund_failed" });
    f.failRefund.on = false;
    await refundLatestCharge(deps.get(), "org_1", { id: "u_1", by: "self" });
    const cus2 = await customerFor("org_2", "someone.else@test.test");
    f.addSub(cus2, "straightpin_monthly_month");
    f.addCharge(cus2, 1099, SEC - 60);
    await hook(event("invoice.paid", { customer: cus2 }));
    expect(await refundEligibility(f.stripe, db, "org_2", NOW)).toMatchObject({ eligible: true });
  });
});
