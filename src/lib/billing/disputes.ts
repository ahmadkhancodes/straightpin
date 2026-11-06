import type Stripe from "stripe";
import { audit as defaultAudit } from "@/lib/audit";
import type { Db, DisputeRecord, Entitlement } from "@/lib/db/types";
import { NONE, cancelAppSubscriptions, computeEntitlement } from "./entitlement";

type AuditFn = (e: { orgId: string | null; actorId: string | null; action: string; target?: string | null; meta?: Record<string, string | number | boolean | null> }) => Promise<unknown>;

/** While any dispute is open the plan stays off, whatever a later subscription event or refresh says (REVIEW P1-1). */
export async function applyDisputeHold(db: Db, orgId: string, ent: Entitlement, now: number): Promise<Entitlement> {
  const open = (await db.listDisputes(orgId)).some((d) => d.status === "open");
  return open ? { ...NONE(now), trialUsed: true } : ent;
}

interface DisputeObject { id: string; charge?: string | { id: string } | null; status?: string }

/**
 * charge.dispute.created / .closed. The dispute carries no customer, so the charge is retrieved to find it.
 *  - created: remember the plan held now, then switch the plan off (Lifetime included)
 *  - closed, won (or warning closed): give the plan back
 *  - closed, lost: keep it off; subscriptions are cancelled and a Lifetime slot is freed
 * Returns the org it touched, or null when the charge is not ours.
 */
export async function handleDispute(
  deps: { stripe: Pick<Stripe, "subscriptions" | "charges">; db: Db; now: number; audit?: AuditFn },
  type: "charge.dispute.created" | "charge.dispute.closed",
  dispute: DisputeObject,
): Promise<string | null> {
  const { stripe, db, now } = deps;
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return null;
  const charge = await stripe.charges.retrieve(chargeId);
  const customerId = typeof charge.customer === "string" ? charge.customer : (charge.customer?.id ?? null);
  if (!customerId) return null;
  const acct = await db.findBillingAccountByCustomer(customerId);
  if (!acct || acct.app !== db.app) return null;
  const orgId = acct.id;
  const audit = deps.audit ?? defaultAudit;
  const existing = (await db.listDisputes(orgId)).find((d) => d.id === dispute.id);
  const others = (await db.listDisputes(orgId)).filter((d) => d.id !== dispute.id);

  if (type === "charge.dispute.created") {
    if (existing && existing.status !== "open") return orgId; // late duplicate of a closed dispute
    const current = await db.getEntitlement(orgId);
    // A second open dispute reuses the plan saved by the first one (the live entitlement is already off).
    const saved = existing?.saved ?? others.find((d) => d.status === "open" && d.saved)?.saved ?? (current?.isPaid ? current : null);
    await db.setDispute({ id: dispute.id, orgId, status: "open", saved, at: new Date(now) });
    await db.setEntitlement(orgId, { ...NONE(now), trialUsed: true });
    await audit({ orgId, actorId: null, action: "billing.dispute_opened", target: dispute.id, meta: { charge: chargeId, plan: saved?.plan ?? null } });
    return orgId;
  }

  const won = dispute.status === "won" || dispute.status === "warning_closed";
  const record: DisputeRecord = { id: dispute.id, orgId, status: won ? "won" : "lost", saved: existing?.saved ?? null, at: new Date(now) };
  await db.setDispute(record);
  const stillOpen = others.some((d) => d.status === "open");
  if (won) {
    if (!stillOpen) {
      if (record.saved?.status === "lifetime") {
        await db.setEntitlement(orgId, { ...record.saved, checkedAt: now });
      } else {
        await db.setEntitlement(orgId, await computeEntitlement(stripe, db.app, customerId, null, now));
      }
    }
    await audit({ orgId, actorId: null, action: "billing.dispute_won", target: dispute.id, meta: { restored: !stillOpen } });
  } else {
    await cancelAppSubscriptions(stripe, db.app, customerId);
    if (record.saved?.status === "lifetime") await db.releaseLifetime(orgId);
    if (!stillOpen) await db.setEntitlement(orgId, { ...NONE(now), trialUsed: true });
    await audit({ orgId, actorId: null, action: "billing.dispute_lost", target: dispute.id, meta: { plan: record.saved?.plan ?? null } });
  }
  return orgId;
}
