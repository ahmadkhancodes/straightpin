import { beforeEach, describe, expect, it } from "vitest";
import { UNLIMITED, freePlan, plansOnSale, type Plan, type PlanPrice } from "@/config/product";
import { clearPriceCache } from "@/lib/billing/catalog";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/checkout";
import { effectivePlan, limitFor } from "@/lib/billing/entitlement";
import { currentUsage } from "@/lib/billing/usage";
import { handleStripeWebhook } from "@/lib/billing/webhook";
import { createMemoryDb } from "@/lib/db/memory";
import type { Db } from "@/lib/db/types";
import { event, fakeStripe } from "./fakes";

const NOW = 1_800_000_000_000;
const SEC = NOW / 1000;
const subject = { orgId: "org_1", email: "dana@studio.test", userId: "u_1" };
const base = "https://app.test";
const urls = { success: `${base}/account?checkout=success`, cancel: `${base}/account?checkout=canceled` };

let db: Db;
let f: ReturnType<typeof fakeStripe>;
beforeEach(() => {
  db = createMemoryDb("straightpin");
  f = fakeStripe(() => SEC);
  clearPriceCache();
});
const hook = (body: string) => handleStripeWebhook(body, "good", { stripe: f.stripe, db, secret: "whsec_x", now: () => NOW });
const sessions = () => f.calls.filter((c) => c.method === "checkout.sessions.create").map((c) => c.args as Record<string, any>);

const cases = plansOnSale().flatMap((plan: Plan) => plan.prices.map((price: PlanPrice) => ({ plan, price })));

const expectLimits = async (planDef: Plan) => {
  const ent = await db.getEntitlement("org_1");
  const eff = effectivePlan(ent, NOW);
  expect(eff.id).toBe(planDef.id);
  expect(limitFor(ent, "opens", NOW)).toBe(planDef.limits.opens);
  expect(limitFor(ent, "saves", NOW)).toBe(planDef.limits.saves);
  expect(eff.alertLimit).toBe(planDef.alertLimit);
  const usage = await currentUsage(db, "org_1", ["opens", "saves"], new Date(NOW));
  expect(usage.map((u) => u.limit)).toEqual([planDef.limits.opens, planDef.limits.saves]);
};

describe("upgrade journey per plan on sale", () => {
  it("covers at least one price", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  describe.each(cases)("$plan.id / $price.interval", ({ plan, price }) => {
    const once = price.interval === "once";

    it("starts Free with the Free limits", async () => {
      const ent = await db.getEntitlement("org_1");
      expect(effectivePlan(ent, NOW).id).toBe("free");
      expect(limitFor(ent, "opens", NOW)).toBe(5);
      expect(limitFor(ent, "saves", NOW)).toBe(10);
    });

    it("checkout creates exactly one session for this app's price", async () => {
      expect(price.lookupKey).toBe(`straightpin_${plan.id}_${price.interval}`);
      const r = await createCheckoutSession(f.stripe, db, subject, plan.id, price.interval, urls);
      expect(r.url).toMatch(/^https:\/\/checkout\.stripe\.test\//);
      const all = sessions();
      expect(all).toHaveLength(1);
      const s = all[0]!;
      expect(s.mode).toBe(once ? "payment" : "subscription");
      expect(s.line_items).toHaveLength(1);
      expect(s.line_items[0].quantity).toBe(1);
      const stripePrice = (await f.stripe.prices.list({ lookup_keys: [price.lookupKey] })).data[0]!;
      expect(stripePrice.lookup_key).toBe(price.lookupKey);
      expect(s.line_items[0].price).toBe(stripePrice.id);
      expect(s.metadata.app).toBe("straightpin");
      expect(s.metadata.plan).toBe(plan.id);
      if (once) expect(s.payment_intent_data.metadata).toMatchObject({ app: "straightpin", mode: "lifetime" });
      else expect(s.subscription_data.metadata.app).toBe("straightpin");
      expect(s.success_url).toBe(`${urls.success}&session_id={CHECKOUT_SESSION_ID}`);
      expect(s.cancel_url).toBe(urls.cancel);
      expect(s.client_reference_id).toBe("org_1");
    });

    it("webhook activates the plan and the enforced limits come from it", async () => {
      await createCheckoutSession(f.stripe, db, subject, plan.id, price.interval, urls);
      const cus = (await db.getBillingAccount("org_1"))!.stripeCustomerId!;
      if (once) {
        await hook(event("payment_intent.succeeded", { id: "pi_j", customer: cus, metadata: { app: "straightpin", mode: "lifetime", lookup_key: price.lookupKey } }));
        expect(await db.getEntitlement("org_1")).toMatchObject({ isPaid: true, status: "lifetime", plan: plan.id });
      } else {
        f.addSub(cus, price.lookupKey);
        await hook(event("checkout.session.completed", { customer: cus }));
        await hook(event("customer.subscription.created", { customer: cus }));
        expect(await db.getEntitlement("org_1")).toMatchObject({ isPaid: true, status: "active", plan: plan.id, interval: price.interval });
      }
      expect(plan.limits).toEqual({ opens: UNLIMITED, saves: UNLIMITED });
      await expectLimits(plan);
    });

    it("portal opens for the checkout customer and returns to /account", async () => {
      await createCheckoutSession(f.stripe, db, subject, plan.id, price.interval, urls);
      const cus = (await db.getBillingAccount("org_1"))!.stripeCustomerId!;
      const ret = `${base}/account`;
      const p = await createPortalSession(f.stripe, db, "org_1", ret);
      expect(p.url).toBe(`https://billing.stripe.test/${cus}`);
      // Same return URL as /api/billing/portal: back to the Account page.
      expect(f.calls.filter((c) => c.method === "billingPortal.sessions.create").map((c) => c.args)).toEqual([{ customer: cus, return_url: ret }]);
    });

    it("cancellation downgrades to Free with the Free limits", async () => {
      await createCheckoutSession(f.stripe, db, subject, plan.id, price.interval, urls);
      const cus = (await db.getBillingAccount("org_1"))!.stripeCustomerId!;
      if (once) {
        await hook(event("payment_intent.succeeded", { id: "pi_j", customer: cus, metadata: { app: "straightpin", mode: "lifetime", lookup_key: price.lookupKey } }));
        await hook(event("charge.refunded", { customer: cus, refunded: true, payment_intent: "pi_j" }));
      } else {
        const sub = f.addSub(cus, price.lookupKey);
        await hook(event("customer.subscription.created", { customer: cus }));
        sub.cancel_at_period_end = true;
        await hook(event("customer.subscription.updated", { customer: cus }));
        expect(await db.getEntitlement("org_1")).toMatchObject({ isPaid: true, plan: plan.id, cancelAtPeriodEnd: true });
        await expectLimits(plan);
        sub.status = "canceled";
        await hook(event("customer.subscription.deleted", { customer: cus }));
      }
      const ent = await db.getEntitlement("org_1");
      expect(ent?.isPaid).toBe(false);
      expect(effectivePlan(ent, NOW).id).toBe("free");
      expect(limitFor(ent, "opens", NOW)).toBe(5);
      expect(limitFor(ent, "saves", NOW)).toBe(10);
      expect(effectivePlan(ent, NOW).alertLimit).toBe(freePlan.alertLimit);
    });
  });
});

describe("isolation", () => {
  it("Plus is refused (not on sale) and another app's price is never used", async () => {
    for (const interval of ["month", "year"] as const)
      await expect(createCheckoutSession(f.stripe, db, subject, "plus", interval, urls)).rejects.toMatchObject({ status: 409, code: "plan_not_on_sale" });
    expect(sessions()).toHaveLength(0);
    // the foreign price shares the monthly lookup-key prefix but carries another app's metadata
    await createCheckoutSession(f.stripe, db, subject, "monthly", "month", urls);
    const s = sessions();
    expect(s).toHaveLength(1);
    expect(s[0]!.line_items[0].price).toBe("price_monthly_m");
    expect(s[0]!.line_items[0].price).not.toBe("price_other");
  });
});
