import type Stripe from "stripe";
import { freePlan, planById, planForLookupKey, product, type MeterId, type Plan, type PlanId } from "@/config/product";
import type { Entitlement } from "@/lib/db/types";
import { HttpError } from "@/lib/http";

// Ported from trayo server/billing.ts (computeEntitlement, periodEndOf, invoiceSubscriptionId, NONE,
// lifetimeEntitlement, cancelAppSubscriptions). Generalised from isPro to multi-tier plans keyed by lookup_key.

export const NONE = (now: number): Entitlement => ({
  isPaid: false,
  status: "none",
  plan: freePlan.id,
  interval: null,
  expiresAt: null,
  trialStartedAt: null,
  cancelAtPeriodEnd: false,
  checkedAt: now,
  trialUsed: false,
  subscriptionId: null,
  lifetimePaymentIntentId: null,
  pastDueSince: null,
});

// Webhook endpoints may be pinned to API version 2022-11-15 (D41). Newer versions moved fields, so read both.
type PeriodSource = { current_period_end?: number | null; items?: { data?: { current_period_end?: number | null }[] } | null };
export function periodEndOf(s: PeriodSource): number | null {
  const sec = s.items?.data?.[0]?.current_period_end ?? s.current_period_end ?? null;
  return sec ? sec * 1000 : null;
}

type InvoiceLike = {
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
};
export function invoiceSubscriptionId(inv: InvoiceLike): string | null {
  const ref = inv.parent?.subscription_details?.subscription ?? inv.subscription ?? null;
  return typeof ref === "string" ? ref : (ref?.id ?? null);
}

/** Minimal Stripe surface we use (lets tests pass a fake). */
export type StripeLike = Pick<Stripe, "subscriptions" | "customers" | "prices" | "checkout" | "billingPortal" | "webhooks">;

const RANK: Record<string, number> = Object.fromEntries(product.plans.map((p, i) => [p.id, i]));

/** Recompute from Stripe subscriptions (order independent, so out-of-order webhooks converge: C-25). */
export async function computeEntitlement(
  stripe: Pick<Stripe, "subscriptions">,
  app: string,
  customerId: string,
  prev: Entitlement | null,
  now: number,
): Promise<Entitlement> {
  if (prev?.status === "lifetime") return { ...prev, checkedAt: now };
  const subs = (await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 })).data.filter(
    (s) => s.metadata?.app === app,
  );
  let best: Entitlement | null = null;
  let trialUsed = !!prev?.trialUsed;
  for (const s of subs) {
    if (s.trial_start) trialUsed = true;
    const item = s.items.data[0];
    const key = item?.price.lookup_key ?? null;
    // C-28: only this app's lookup keys count.
    const match = key && key.startsWith(`${app}_`) ? planForLookupKey(key) : null;
    if (!match) continue;
    const live = ["trialing", "active", "past_due"].includes(s.status);
    const periodEnd = periodEndOf(s as unknown as PeriodSource);
    const status: Entitlement["status"] =
      s.status === "trialing" ? "trialing" : s.status === "active" ? "active" : s.status === "past_due" ? "past_due" : "canceled";
    const cand: Entitlement = {
      isPaid: live,
      status,
      plan: live ? match.plan.id : freePlan.id,
      interval: match.price.interval,
      expiresAt: s.status === "trialing" && s.trial_end ? s.trial_end * 1000 : periodEnd,
      trialStartedAt: s.trial_start ? s.trial_start * 1000 : null,
      cancelAtPeriodEnd: s.cancel_at_period_end,
      checkedAt: now,
      trialUsed: true,
      subscriptionId: s.id,
      lifetimePaymentIntentId: null,
      pastDueSince: status === "past_due" ? (prev?.status === "past_due" && prev.pastDueSince ? prev.pastDueSince : now) : null,
    };
    // live beats dead; then higher plan; then later expiry
    if (
      !best ||
      (cand.isPaid && !best.isPaid) ||
      (cand.isPaid === best.isPaid && (RANK[cand.plan]! > RANK[best.plan]! ||
        (cand.plan === best.plan && (cand.expiresAt ?? 0) > (best.expiresAt ?? 0))))
    )
      best = cand;
  }
  return best ?? { ...NONE(now), trialUsed };
}

export function lifetimeEntitlement(plan: PlanId, piId: string, now: number): Entitlement {
  return { ...NONE(now), isPaid: true, status: "lifetime", plan, trialUsed: true, lifetimePaymentIntentId: piId };
}

/** Cancel every live subscription of this app for the customer (account deletion, full refunds). */
export async function cancelAppSubscriptions(stripe: Pick<Stripe, "subscriptions">, app: string, customerId: string) {
  const subs = (await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 })).data;
  for (const s of subs) {
    if (s.metadata?.app === app && ["active", "trialing", "past_due", "incomplete", "unpaid"].includes(s.status))
      await stripe.subscriptions.cancel(s.id);
  }
}

/**
 * The plan that applies right now. Read-time expiry check (Jotflow rule): a missed webhook cannot keep a plan on.
 * past_due keeps the plan for product.graceDays (C-20), then falls back to Free.
 */
export function effectivePlan(e: Entitlement | null, now = Date.now()): Plan {
  if (!e || !e.isPaid) return freePlan;
  if (e.status === "lifetime") return planById(e.plan) ?? freePlan;
  const slack = 2 * 864e5; // tolerate renewal webhooks arriving a little late
  if (e.expiresAt && e.expiresAt + slack < now) return freePlan;
  if (e.status === "past_due" && e.pastDueSince && e.pastDueSince + product.graceDays * 864e5 < now) return freePlan;
  return planById(e.plan) ?? freePlan;
}

export function limitFor(e: Entitlement | null, meter: MeterId, now = Date.now()): number {
  return effectivePlan(e, now).limits[meter];
}

/** Throws 402 plan_required unless the org's effective plan is at least `min`. Server-side only. */
export function requirePlan(e: Entitlement | null, min: PlanId, now = Date.now()): Plan {
  const p = effectivePlan(e, now);
  if (RANK[p.id]! < RANK[min]!) throw new HttpError(402, "plan_required", { required: min, current: p.id });
  return p;
}

export const planRank = (id: PlanId) => RANK[id]!;
