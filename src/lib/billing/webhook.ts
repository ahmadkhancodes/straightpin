import type Stripe from "stripe";
import { planForLookupKey } from "@/config/product";
import type { Db } from "@/lib/db/types";
import { json } from "@/lib/http";
import { log } from "@/lib/logger";
import { NONE, cancelAppSubscriptions, computeEntitlement, invoiceSubscriptionId, lifetimeEntitlement } from "./entitlement";

// Ported from trayo server/handler.ts webhook(). Changes:
//  - the event id is recorded AFTER successful processing (failures now get Stripe retries; 2.2 #4)
//  - billing subject is the org (billing_accounts.stripeCustomerId)
//  - checkout.session.completed also triggers a recompute

export interface WebhookDeps {
  stripe: Pick<Stripe, "subscriptions" | "webhooks">;
  db: Db;
  secret: string;
  now?: () => number;
  onChange?: (orgId: string, type: string) => Promise<void>;
}

export async function handleStripeWebhook(rawBody: string, signature: string | null, deps: WebhookDeps): Promise<Response> {
  const { stripe, db } = deps;
  const app = db.app;
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature ?? "", deps.secret);
  } catch {
    return json({ error: "bad_signature" }, 400); // C-26: nothing written
  }
  if (await db.hasStripeEvent(event.id)) return json({ received: true, duplicate: true }); // C-25

  const obj = event.data.object as {
    customer?: string | { id: string } | null;
    metadata?: Record<string, string> | null;
    id?: string;
    payment_intent?: string | null;
    refunded?: boolean;
  };
  let customerId = typeof obj.customer === "string" ? obj.customer : (obj.customer?.id ?? null);
  // Old (2022-11-15) and new invoice payloads keep the subscription in different places; fall back to it.
  if (!customerId && event.type.startsWith("invoice.")) {
    const subId = invoiceSubscriptionId(obj as Parameters<typeof invoiceSubscriptionId>[0]);
    if (subId) {
      const sub = await stripe.subscriptions.retrieve(subId);
      customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null);
    }
  }
  if (!customerId) {
    await db.markStripeEvent(event.id, event.type);
    return json({ received: true });
  }
  const acct = await db.findBillingAccountByCustomer(customerId);
  if (!acct || acct.app !== app) return json({ received: true, ignored: true }); // other apps' customers
  const orgId = acct.id;
  const prev = await db.getEntitlement(orgId);
  const now = (deps.now ?? Date.now)();

  if (event.type === "payment_intent.succeeded") {
    const plan = obj.metadata?.plan;
    const match = obj.metadata?.lookup_key ? planForLookupKey(obj.metadata.lookup_key) : null;
    if (obj.metadata?.app === app && obj.metadata?.mode === "lifetime" && obj.id && match) {
      await db.setEntitlement(orgId, lifetimeEntitlement(match.plan.id, obj.id, now));
      await deps.onChange?.(orgId, event.type);
    } else if (plan) log.debug("pi_ignored", { code: "not_lifetime" });
    await db.markStripeEvent(event.id, event.type);
    return json({ received: true });
  }

  if (event.type === "charge.refunded" && obj.refunded) {
    // C-27: a FULL refund ends the paid plan. Lifetime: drop it; subscription: cancel now. Partial refunds ignored.
    if (prev?.status === "lifetime" && prev.lifetimePaymentIntentId === obj.payment_intent) {
      await db.setEntitlement(orgId, { ...NONE(now), trialUsed: true });
      await db.markStripeEvent(event.id, event.type);
      await deps.onChange?.(orgId, event.type);
      return json({ received: true });
    }
    await cancelAppSubscriptions(stripe, app, customerId);
  }

  const relevant =
    event.type.startsWith("customer.subscription.") ||
    event.type.startsWith("invoice.") ||
    event.type === "checkout.session.completed" ||
    event.type === "charge.refunded";
  if (relevant) {
    await db.setEntitlement(orgId, await computeEntitlement(stripe, app, customerId, prev?.status === "lifetime" ? prev : null, now));
    await deps.onChange?.(orgId, event.type);
  }
  await db.markStripeEvent(event.id, event.type); // only after success
  return json({ received: true });
}
