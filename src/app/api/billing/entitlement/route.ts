import { product, type MeterId } from "@/config/product";
import { requireOrg } from "@/lib/auth/session";
import { computeEntitlement, effectivePlan } from "@/lib/billing/entitlement";
import { getStripe } from "@/lib/billing/stripe";
import { currentUsage } from "@/lib/billing/usage";
import { getDb } from "@/lib/db";
import { json, withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ?refresh=1 asks Stripe directly so a plan unlocks right after checkout without waiting for the webhook (C-13). */
export const GET = withApi(async (req) => {
  const ctx = await requireOrg();
  const db = await getDb();
  let ent = await db.getEntitlement(ctx.org.id);
  const stripe = getStripe();
  if (new URL(req.url).searchParams.get("refresh") === "1" && stripe) {
    const acct = await db.getBillingAccount(ctx.org.id);
    if (acct?.stripeCustomerId) {
      ent = await computeEntitlement(stripe, db.app, acct.stripeCustomerId, ent, Date.now());
      await db.setEntitlement(ctx.org.id, ent);
    }
  }
  const plan = effectivePlan(ent);
  const meters = Object.keys(plan.limits) as MeterId[];
  return json({ plan: { id: plan.id, name: plan.name }, entitlement: ent, usage: await currentUsage(db, ctx.org.id, meters), currency: product.currency });
});
