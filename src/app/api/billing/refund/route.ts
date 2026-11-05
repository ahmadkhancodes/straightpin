import { requireOrg, requirePermission } from "@/lib/auth/session";
import { refundLatestCharge } from "@/lib/billing/lifecycle";
import { requireStripe } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db";
import { json, withApi } from "@/lib/http";
import { enforceRateLimit, RULES } from "@/lib/security/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Self serve 7 day refund of the latest charge, once per customer. Turns the plan off. */
export const POST = withApi(async () => {
  const ctx = await requireOrg();
  requirePermission(ctx, "billing", "manage");
  const db = await getDb();
  await enforceRateLimit(`billing:${ctx.user.id}`, RULES.billing, db);
  const r = await refundLatestCharge({ stripe: requireStripe(), db }, ctx.org.id, { id: ctx.user.id, by: "self" });
  return json({ ok: true, amount: r.amount });
});
