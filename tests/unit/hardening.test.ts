import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearPriceCache } from "@/lib/billing/catalog";
import { runRenewalReminders } from "@/lib/billing/reminders";
import { handleStripeWebhook } from "@/lib/billing/webhook";
import { NONE } from "@/lib/billing/entitlement";
import { createMemoryDb } from "@/lib/db/memory";
import type { Db } from "@/lib/db/types";
import { event, fakeStripe } from "./fakes";

// Launch hardening: webhook ordering and unknown events, mail provider rejections.
vi.mock("@/lib/mail", async (orig) => ({ ...(await orig<object>()), sendMail: vi.fn(async () => { throw new Error("mail_send_failed_422 secret-provider-detail"); }) }));

const NOW = 1_800_000_000_000;
const SEC = NOW / 1000;
let db: Db;
let f: ReturnType<typeof fakeStripe>;
beforeEach(() => {
  db = createMemoryDb("straightpin");
  f = fakeStripe(() => SEC);
  clearPriceCache();
});
const hook = (body: string) => handleStripeWebhook(body, "good", { stripe: f.stripe, db, secret: "whsec_x", now: () => NOW });
const withEvent = (type: string, object: Record<string, unknown>, extra: Record<string, unknown>) => JSON.stringify({ ...JSON.parse(event(type, object)), ...extra });
const customer = async () => {
  await db.upsertBillingAccount({ id: "org_1", stripeCustomerId: "cus_1", email: "a@x.test" });
  return "cus_1";
};

describe("webhook hardening", () => {
  it("an unknown event type answers 200 and does not change the plan", async () => {
    const cus = await customer();
    f.addSub(cus, "straightpin_monthly_month");
    await hook(event("customer.subscription.created", { customer: cus }));
    const before = await db.getEntitlement("org_1");
    const res = await hook(event("some.future.event", { customer: cus }));
    expect(res.status).toBe(200);
    expect((await db.getEntitlement("org_1"))!.plan).toBe(before!.plan);
  });

  it("a late charge.refunded does not cancel a subscription bought after the refund", async () => {
    const cus = await customer();
    f.addSub(cus, "straightpin_monthly_month", "active", { created: SEC + 500 } as never);
    const res = await hook(withEvent("charge.refunded", { customer: cus, refunded: true, payment_intent: "pi_old" }, { created: SEC }));
    expect(res.status).toBe(200);
    expect(f.subs[0]!.status).toBe("active");
    expect((await db.getEntitlement("org_1"))!.isPaid).toBe(true);
  });

  it("a duplicate delivery changes nothing", async () => {
    const cus = await customer();
    f.addSub(cus, "straightpin_monthly_month");
    const body = event("customer.subscription.updated", { customer: cus }, "evt_dup");
    await hook(body);
    f.subs[0]!.status = "canceled"; // a second copy must not re-read Stripe
    expect(((await (await hook(body)).json()) as { duplicate?: boolean }).duplicate).toBe(true);
    expect((await db.getEntitlement("org_1"))!.isPaid).toBe(true);
  });
});

describe("mail provider rejection", () => {
  it("magic link and invite mail never throw and report failure quietly", async () => {
    const { sendAuthMail } = await import("@/lib/auth");
    await expect(sendAuthMail({ to: "bad@x.test", subject: "s", text: "t", html: "h" }, "magic_link_send_failed")).resolves.toBe(false);
  });

  it("a rejected renewal reminder does not stop the run", async () => {
    const ent = { ...NONE(NOW), isPaid: true, status: "active" as const, plan: "monthly" as const, interval: "month" as const, expiresAt: NOW + 2 * 864e5, trialUsed: true };
    for (const id of ["o1", "o2"]) {
      await db.upsertBillingAccount({ id, stripeCustomerId: `c_${id}`, email: `${id}@x.test` });
      await db.setEntitlement(id, ent);
    }
    const send = vi.fn(async () => { throw new Error("rate limited"); });
    const r = await runRenewalReminders(db, new Date(NOW), send, async () => "https://app.test/u");
    expect(r).toMatchObject({ failed: 2, sent: 0 });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
