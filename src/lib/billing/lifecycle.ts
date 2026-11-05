import type Stripe from "stripe";
import { planById, product } from "@/config/product";
import { audit as defaultAudit } from "@/lib/audit";
import type { Db, Entitlement } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import { sendMail } from "@/lib/mail";
import type { MailMessage } from "@/lib/mail";
import { refundEmail } from "@/lib/mail/templates";
import { NONE, cancelAppSubscriptions, computeEntitlement } from "./entitlement";

type AuditFn = (e: { orgId: string | null; actorId: string | null; action: string; target?: string | null; meta?: Record<string, string | number | boolean | null> }) => Promise<unknown>;

export interface LifecycleDeps {
  stripe: Pick<Stripe, "subscriptions" | "charges" | "refunds">;
  db: Db;
  send?: (m: MailMessage) => Promise<unknown>;
  audit?: AuditFn;
  now?: () => number;
}

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

/** Cancel at the end of the paid period (the user keeps the plan until then). Lifetime has nothing to cancel. */
export async function cancelAtPeriodEnd(deps: LifecycleDeps, orgId: string, actorId: string): Promise<Entitlement> {
  const { stripe, db } = deps;
  const now = (deps.now ?? Date.now)();
  const ent = await db.getEntitlement(orgId);
  const acct = await db.getBillingAccount(orgId);
  if (!ent?.isPaid || ent.status === "lifetime" || !ent.subscriptionId || !acct?.stripeCustomerId) throw new HttpError(409, "nothing_to_cancel");
  await stripe.subscriptions.update(ent.subscriptionId, { cancel_at_period_end: true });
  const next = await computeEntitlement(stripe, db.app, acct.stripeCustomerId, null, now);
  await db.setEntitlement(orgId, next);
  await (deps.audit ?? defaultAudit)({ orgId, actorId, action: "billing.cancel_requested", target: ent.subscriptionId });
  return next;
}

export interface RefundResult {
  refundId: string;
  chargeId: string;
  amount: number;
}

/** The newest charge that can still be refunded (succeeded, nothing refunded yet). Charges list newest first. */
function refundableCharge(charges: Stripe.Charge[], app: string): Stripe.Charge | undefined {
  return charges.find((c) => c.status === "succeeded" && !c.refunded && c.amount_refunded === 0 && (c.metadata?.app ?? app) === app);
}

/**
 * Refund the latest charge through the Stripe API. Rules:
 *  - the customer must hold a paid plan and the charge must be inside product.refundDays (admins can waive the window)
 *  - once per customer: the reservation row is written before Stripe is called and given back only if Stripe fails
 * A full refund ends the plan right away (the charge.refunded webhook then converges to the same state).
 */
export async function refundLatestCharge(deps: LifecycleDeps, orgId: string, actor: { id: string; by: "self" | "admin" }): Promise<RefundResult> {
  const { stripe, db } = deps;
  const now = (deps.now ?? Date.now)();
  const acct = await db.getBillingAccount(orgId);
  const ent = await db.getEntitlement(orgId);
  if (!acct?.stripeCustomerId) throw new HttpError(404, "no_customer");
  if (!ent?.isPaid) throw new HttpError(409, "nothing_to_refund");
  const customerId = acct.stripeCustomerId;
  if (await db.getRefund(customerId)) throw new HttpError(409, "refund_already_used");

  const charge = refundableCharge((await stripe.charges.list({ customer: customerId, limit: 10 })).data, db.app);
  if (!charge) throw new HttpError(404, "no_charge");
  if (actor.by === "self" && now - charge.created * 1000 > product.refundDays * 864e5) throw new HttpError(409, "refund_window_closed");

  const reserved = await db.reserveRefund({ customerId, orgId, chargeId: charge.id, amount: charge.amount, by: actor.by, at: new Date(now) });
  if (!reserved) throw new HttpError(409, "refund_already_used");
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create({ charge: charge.id, metadata: { app: db.app, org_id: orgId, by: actor.by } }, { idempotencyKey: `${db.app}-refund-${customerId}` });
  } catch (e) {
    await db.releaseRefund(customerId);
    throw new HttpError(502, "refund_failed", (e as Error).message);
  }

  const planName = planById(ent.plan)?.name ?? ent.plan;
  if (ent.status === "lifetime") {
    await db.setEntitlement(orgId, { ...NONE(now), trialUsed: true });
    await db.releaseLifetime(orgId);
  } else {
    await cancelAppSubscriptions(stripe, db.app, customerId);
    await db.setEntitlement(orgId, await computeEntitlement(stripe, db.app, customerId, null, now));
  }
  await (deps.audit ?? defaultAudit)({
    orgId,
    actorId: actor.id,
    action: "billing.refunded",
    target: charge.id,
    meta: { refundId: refund.id, amount: charge.amount, by: actor.by, plan: ent.plan },
  });
  if (acct.email) {
    const m = refundEmail({ amountText: money(charge.amount), planName });
    await (deps.send ?? ((x) => sendMail(x)))({ to: acct.email, subject: m.subject, text: m.text, html: m.html, category: "transactional", tags: { kind: "refund" } }).catch(() => undefined);
  }
  return { refundId: refund.id, chargeId: charge.id, amount: charge.amount };
}

/** Can the signed in customer still use the self serve refund button? (UI hint; the server re-checks.) */
export async function refundEligibility(
  stripe: Pick<Stripe, "charges">,
  db: Db,
  orgId: string,
  now = Date.now(),
): Promise<{ eligible: boolean; reason: "ok" | "used" | "window" | "none"; until: number | null }> {
  const acct = await db.getBillingAccount(orgId);
  const ent = await db.getEntitlement(orgId);
  if (!acct?.stripeCustomerId || !ent?.isPaid) return { eligible: false, reason: "none", until: null };
  if (await db.getRefund(acct.stripeCustomerId)) return { eligible: false, reason: "used", until: null };
  const c = refundableCharge((await stripe.charges.list({ customer: acct.stripeCustomerId, limit: 10 })).data, db.app);
  if (!c) return { eligible: false, reason: "none", until: null };
  const until = c.created * 1000 + product.refundDays * 864e5;
  return now <= until ? { eligible: true, reason: "ok", until } : { eligible: false, reason: "window", until };
}
