import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryDb } from "@/lib/db/memory";
import type { Db } from "@/lib/db/types";
import { clearPriceCache } from "@/lib/billing/catalog";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/checkout";
import { NONE, effectivePlan, invoiceSubscriptionId, lifetimeEntitlement, periodEndOf, requirePlan } from "@/lib/billing/entitlement";
import { handleStripeWebhook } from "@/lib/billing/webhook";
import { event, fakeStripe } from "./fakes";

const NOW = 1_800_000_000_000;
const subject = { orgId: "org_1", email: "dana@studio.test", userId: "u_1" };
const urls = { success: "https://app.test/app/billing?checkout=success", cancel: "https://app.test/app/billing" };

let db: Db;
let f: ReturnType<typeof fakeStripe>;
beforeEach(() => {
  db = createMemoryDb("straightpin");
  f = fakeStripe();
  clearPriceCache();
});
const hook = (body: string, sig = "good") => handleStripeWebhook(body, sig, { stripe: f.stripe, db, secret: "whsec_x", now: () => NOW });

// D41 (ported billingVersions.test.ts)
describe("Stripe API version tolerance", () => {
  it("periodEndOf reads the item (2025+) or the subscription (2022-11-15)", () => {
    expect(periodEndOf({ items: { data: [{ current_period_end: 1_900_000_000 }] } })).toBe(1_900_000_000_000);
    expect(periodEndOf({ current_period_end: 1_950_000_000, items: { data: [{}] } })).toBe(1_950_000_000_000);
    expect(periodEndOf({ items: { data: [] } })).toBeNull();
  });
  it("invoiceSubscriptionId reads invoice.subscription (2022-11-15) or parent.subscription_details", () => {
    expect(invoiceSubscriptionId({ subscription: "sub_old" })).toBe("sub_old");
    expect(invoiceSubscriptionId({ subscription: { id: "sub_exp" } })).toBe("sub_exp");
    expect(invoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_new" } } })).toBe("sub_new");
    expect(invoiceSubscriptionId({ parent: null })).toBeNull();
  });
});

describe("checkout", () => {
  it("creates a hosted Checkout Session for this app's price, tagged metadata.app (C-28)", async () => {
    const r = await createCheckoutSession(f.stripe, db, subject, "monthly", "month", urls);
    expect(r.url).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    const call = f.calls.find((c) => c.method === "checkout.sessions.create")!.args as Record<string, any>;
    expect(call.mode).toBe("subscription");
    expect(call.line_items[0].price).toBe("price_monthly");
    expect(call.subscription_data.metadata).toMatchObject({ app: "straightpin", plan: "monthly", org_id: "org_1" });
    expect(call.client_reference_id).toBe("org_1");
    expect(call.success_url).toContain("{CHECKOUT_SESSION_ID}");
    expect((await db.getBillingAccount("org_1"))?.stripeCustomerId).toMatch(/^cus_/);
  });

  it("rejects the free plan, unknown intervals and foreign prices", async () => {
    await expect(createCheckoutSession(f.stripe, db, subject, "free", "month", urls)).rejects.toMatchObject({ code: "bad_plan" });
    await expect(createCheckoutSession(f.stripe, db, subject, "plus", "month", urls)).rejects.toMatchObject({ code: "bad_plan" }); // coming soon
    await expect(createCheckoutSession(f.stripe, db, subject, "weekly", "month", urls)).rejects.toMatchObject({ code: "unknown_price" });
  });

  it("no duplicate live subscription (409 already_subscribed)", async () => {
    await createCheckoutSession(f.stripe, db, subject, "monthly", "month", urls);
    const cus = (await db.getBillingAccount("org_1"))!.stripeCustomerId!;
    f.addSub(cus, "straightpin_monthly");
    await expect(createCheckoutSession(f.stripe, db, subject, "weekly", "week", urls)).rejects.toMatchObject({ status: 409, code: "already_subscribed" });
  });

  it("reuses the customer and opens the portal", async () => {
    await createCheckoutSession(f.stripe, db, subject, "monthly", "month", urls);
    await createCheckoutSession(f.stripe, db, subject, "weekly", "week", urls);
    expect(f.customers.size).toBe(1);
    const p = await createPortalSession(f.stripe, db, "org_1", "https://app.test/app/billing");
    expect(p.url).toContain("billing.stripe.test");
    await expect(createPortalSession(f.stripe, db, "org_none", "x")).rejects.toMatchObject({ code: "no_customer" });
  });
});

describe("webhook", () => {
  const setup = async () => {
    await createCheckoutSession(f.stripe, db, subject, "monthly", "month", urls);
    return (await db.getBillingAccount("org_1"))!.stripeCustomerId!;
  };

  it("C-26: bad signature -> 400 and nothing written", async () => {
    const cus = await setup();
    const r = await hook(event("customer.subscription.created", { customer: cus }, "evt_bad"), "nope");
    expect(r.status).toBe(400);
    expect(await db.getEntitlement("org_1")).toBeNull();
    expect(await db.hasStripeEvent("evt_bad")).toBe(false);
  });

  it("checkout.session.completed activates the plan (recompute from Stripe)", async () => {
    const cus = await setup();
    f.addSub(cus, "straightpin_monthly");
    const r = await hook(event("checkout.session.completed", { customer: cus }));
    expect(r.status).toBe(200);
    const e = await db.getEntitlement("org_1");
    expect(e).toMatchObject({ isPaid: true, status: "active", plan: "monthly", interval: "month" });
    expect(effectivePlan(e, NOW).id).toBe("monthly");
  });

  it("C-20: past_due keeps the plan (grace), then Stripe cancelling ends it", async () => {
    const cus = await setup();
    const s = f.addSub(cus, "straightpin_monthly", "past_due");
    await hook(event("invoice.payment_failed", { customer: cus }));
    const e = await db.getEntitlement("org_1");
    expect(e).toMatchObject({ isPaid: true, status: "past_due", pastDueSince: NOW });
    expect(effectivePlan(e, NOW).id).toBe("monthly");
    expect(effectivePlan(e, NOW + 8 * 864e5).id).toBe("free"); // grace over
    s.status = "canceled";
    await hook(event("customer.subscription.deleted", { customer: cus }));
    expect(await db.getEntitlement("org_1")).toMatchObject({ isPaid: false, plan: "free" });
  });

  it("C-25: duplicate events are ignored, out-of-order delivery converges", async () => {
    const cus = await setup();
    f.addSub(cus, "straightpin_monthly");
    const body = event("customer.subscription.updated", { customer: cus }, "evt_dup");
    await hook(body);
    const second = await (await hook(body)).json();
    expect(second.duplicate).toBe(true);
    // an older "created" event arriving last still recomputes to the same truth
    await hook(event("customer.subscription.created", { customer: cus }));
    expect((await db.getEntitlement("org_1"))?.plan).toBe("monthly");
  });

  it("records the event only AFTER success, so a failed run is retried", async () => {
    const cus = await setup();
    f.addSub(cus, "straightpin_monthly");
    const orig = f.stripe.subscriptions.list;
    (f.stripe.subscriptions as any).list = async () => { throw new Error("stripe down"); };
    const body = event("invoice.paid", { customer: cus }, "evt_retry");
    await expect(hook(body)).rejects.toThrow("stripe down");
    expect(await db.hasStripeEvent("evt_retry")).toBe(false);
    (f.stripe.subscriptions as any).list = orig;
    expect((await (await hook(body)).json()).duplicate).toBeUndefined();
    expect(await db.hasStripeEvent("evt_retry")).toBe(true);
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(true);
  });

  it("C-27: full refund cancels the subscription and ends the plan; partial refund is ignored", async () => {
    const cus = await setup();
    f.addSub(cus, "straightpin_monthly");
    await hook(event("invoice.paid", { customer: cus }));
    await hook(event("charge.refunded", { customer: cus, refunded: false, payment_intent: "pi_1" }));
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(true);
    await hook(event("charge.refunded", { customer: cus, refunded: true, payment_intent: "pi_1" }));
    expect(f.calls.some((c) => c.method === "subscriptions.cancel")).toBe(true);
    expect(await db.getEntitlement("org_1")).toMatchObject({ isPaid: false, plan: "free" });
  });

  it("C-27: full refund of a lifetime purchase drops it (keeps trialUsed)", async () => {
    const cus = await setup();
    await db.setEntitlement("org_1", lifetimeEntitlement("lifetime", "pi_life", NOW));
    await hook(event("charge.refunded", { customer: cus, refunded: true, payment_intent: "pi_life" }));
    expect(await db.getEntitlement("org_1")).toMatchObject({ isPaid: false, status: "none", trialUsed: true });
  });

  it("2022-11-15 invoice without customer resolves it through the subscription", async () => {
    const cus = await setup();
    const s = f.addSub(cus, "straightpin_plus_annual");
    await hook(event("invoice.paid", { subscription: s.id }));
    expect(f.calls.some((c) => c.method === "subscriptions.retrieve")).toBe(true);
    expect((await db.getEntitlement("org_1"))?.plan).toBe("plus");
  });

  it("ignores other apps' customers and other apps' subscriptions", async () => {
    const cus = await setup();
    const r = await (await hook(event("invoice.paid", { customer: "cus_foreign" }))).json();
    expect(r.ignored).toBe(true);
    f.addSub(cus, "straightpin_monthly", "active", { metadata: { app: "otherapp" } });
    await hook(event("invoice.paid", { customer: cus }));
    expect((await db.getEntitlement("org_1"))?.isPaid).toBe(false);
  });

  it("the best live subscription wins (higher plan beats lower)", async () => {
    const cus = await setup();
    f.addSub(cus, "straightpin_weekly");
    f.addSub(cus, "straightpin_plus_monthly");
    await hook(event("customer.subscription.updated", { customer: cus }));
    expect((await db.getEntitlement("org_1"))?.plan).toBe("plus");
  });
});

describe("gating", () => {
  it("requirePlan throws 402 plan_required below the minimum; expired entitlements fall to free", () => {
    expect(() => requirePlan(null, "monthly", NOW)).toThrow("plan_required");
    const e = { ...NONE(NOW), isPaid: true, status: "active" as const, plan: "monthly" as const, expiresAt: NOW - 10 * 864e5 };
    expect(effectivePlan(e, NOW).id).toBe("free"); // missed webhook cannot keep a plan on forever
    expect(requirePlan({ ...e, expiresAt: NOW + 864e5 }, "weekly", NOW).id).toBe("monthly");
  });
});

describe("lifetime + daily meter (Straightpin)", () => {
  it("lifetime uses one time Checkout (mode payment) and tags the PaymentIntent", async () => {
    const r = await createCheckoutSession(f.stripe, db, subject, "lifetime", "once", urls);
    expect(r.url).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    const call = f.calls.find((c) => c.method === "checkout.sessions.create")!.args as Record<string, any>;
    expect(call.mode).toBe("payment");
    expect(call.line_items[0].price).toBe("price_lifetime");
    expect(call.payment_intent_data.metadata).toMatchObject({ app: "straightpin", mode: "lifetime", lookup_key: "straightpin_lifetime" });
  });

  it("lifetime is refused when the cap is reached, and for someone who already has it", async () => {
    await db.setEntitlement("org_1", lifetimeEntitlement("lifetime", "pi_a", NOW));
    await expect(createCheckoutSession(f.stripe, db, subject, "monthly", "month", urls)).rejects.toMatchObject({ status: 409, code: "already_subscribed" });
    const { product } = await import("@/config/product");
    const orig = product.lifetimeCap;
    (product as { lifetimeCap: number }).lifetimeCap = 1;
    try {
      await expect(createCheckoutSession(f.stripe, db, { ...subject, orgId: "org_2" }, "lifetime", "once", urls)).rejects.toMatchObject({ status: 409, code: "lifetime_sold_out" });
    } finally {
      (product as { lifetimeCap: number }).lifetimeCap = orig;
    }
  });

  it("payment_intent.succeeded with mode=lifetime grants the plan forever", async () => {
    const cus = await (async () => {
      await createCheckoutSession(f.stripe, db, subject, "lifetime", "once", urls);
      return (await db.getBillingAccount("org_1"))!.stripeCustomerId!;
    })();
    await hook(event("payment_intent.succeeded", { id: "pi_l1", customer: cus, metadata: { app: "straightpin", mode: "lifetime", plan: "lifetime", lookup_key: "straightpin_lifetime" } }));
    const e = await db.getEntitlement("org_1");
    expect(e).toMatchObject({ isPaid: true, status: "lifetime", plan: "lifetime" });
    expect(effectivePlan(e, NOW + 900 * 864e5).id).toBe("lifetime");
  });

  it("opens_day meter resets every UTC day", async () => {
    const { meter } = await import("@/lib/billing/usage");
    const d1 = new Date("2026-11-05T10:00:00Z");
    const d2 = new Date("2026-11-06T00:30:00Z");
    for (let i = 0; i < 5; i++) expect((await meter(db, "org_f", "opens_day", 1, d1)).within).toBe(true);
    expect((await meter(db, "org_f", "opens_day", 1, d1)).within).toBe(false);
    expect((await meter(db, "org_f", "opens_day", 1, d2)).within).toBe(true);
  });
});
