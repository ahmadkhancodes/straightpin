import type Stripe from "stripe";
import { planById, product, type Interval, type PlanId } from "@/config/product";
import type { Db } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import { findPrice } from "./catalog";

// Web replacement for trayo createSubscription (PaymentIntent + ephemeral key): hosted Stripe Checkout.
// Kept: app isolation, one trial per customer (C-19), no second live sub (409 already_subscribed).

export interface BillingSubject {
  orgId: string;
  email: string | null;
  userId: string;
}

export async function ensureCustomer(stripe: Pick<Stripe, "customers">, db: Db, s: BillingSubject): Promise<Stripe.Customer> {
  const acct = await db.getBillingAccount(s.orgId);
  if (acct?.stripeCustomerId) {
    const c = await stripe.customers.retrieve(acct.stripeCustomerId);
    if (!("deleted" in c && c.deleted)) return c as Stripe.Customer;
  }
  const c = await stripe.customers.create(
    { email: s.email ?? undefined, metadata: { app: db.app, org_id: s.orgId, user_id: s.userId } },
    { idempotencyKey: `${db.app}-cust-${s.orgId}` },
  );
  await db.upsertBillingAccount({ id: s.orgId, stripeCustomerId: c.id, email: s.email });
  return c;
}

export async function createCheckoutSession(
  stripe: Pick<Stripe, "customers" | "subscriptions" | "prices" | "checkout">,
  db: Db,
  s: BillingSubject,
  plan: PlanId,
  interval: Interval,
  urls: { success: string; cancel: string },
): Promise<{ url: string }> {
  const def = planById(plan);
  if (!def || def.prices.length === 0 || def.comingSoon) throw new HttpError(400, "bad_plan");
  const price = await findPrice(stripe, db.app, plan, interval);
  if (!price) throw new HttpError(400, "unknown_price");
  const oneTime = interval === "once";
  if (oneTime ? !!price.recurring : !price.recurring) throw new HttpError(400, "unknown_price");
  const customer = await ensureCustomer(stripe, db, s);
  const ent = await db.getEntitlement(s.orgId);
  if (ent?.status === "lifetime") throw new HttpError(409, "already_subscribed");
  const past = (await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 20 })).data.filter(
    (x) => x.metadata?.app === db.app,
  );
  if (past.some((x) => ["active", "trialing", "past_due"].includes(x.status))) throw new HttpError(409, "already_subscribed");
  const meta = { app: db.app, plan, interval, org_id: s.orgId, user_id: s.userId };
  const successUrl = `${urls.success}${urls.success.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
  const common = {
    customer: customer.id,
    client_reference_id: s.orgId,
    line_items: [{ price: price.id, quantity: 1 }],
    allow_promotion_codes: true,
    automatic_tax: { enabled: false },
    billing_address_collection: "auto" as const,
    customer_update: { address: "auto" as const, name: "auto" as const },
    metadata: meta,
    success_url: successUrl,
    cancel_url: urls.cancel,
  };
  if (oneTime) {
    // Lifetime: capped for the first buyers (brief). payment_intent.succeeded with mode=lifetime grants the plan.
    if ((await db.countEntitlements("lifetime")) >= product.lifetimeCap) throw new HttpError(409, "lifetime_sold_out");
    const session = await stripe.checkout.sessions.create({
      ...common,
      mode: "payment",
      payment_intent_data: { metadata: { ...meta, mode: "lifetime", lookup_key: price.lookup_key ?? "" } },
    });
    if (!session.url) throw new HttpError(500, "no_checkout_url");
    return { url: session.url };
  }
  const trialUsed = customer.metadata?.trial_used === "true" || !!ent?.trialUsed || past.some((x) => !!x.trial_start);
  const trialDays = !trialUsed && def.trialDays > 0 ? def.trialDays : undefined;
  const session = await stripe.checkout.sessions.create({
    ...common,
    mode: "subscription",
    subscription_data: {
      metadata: meta,
      ...(trialDays ? { trial_period_days: trialDays, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } } : {}),
    },
  });
  if (trialDays) await stripe.customers.update(customer.id, { metadata: { ...customer.metadata, app: db.app, trial_used: "true" } });
  if (!session.url) throw new HttpError(500, "no_checkout_url");
  return { url: session.url };
}

export async function createPortalSession(stripe: Pick<Stripe, "billingPortal">, db: Db, orgId: string, returnUrl: string) {
  const acct = await db.getBillingAccount(orgId);
  if (!acct?.stripeCustomerId) throw new HttpError(404, "no_customer");
  const s = await stripe.billingPortal.sessions.create({ customer: acct.stripeCustomerId, return_url: returnUrl });
  return { url: s.url };
}
