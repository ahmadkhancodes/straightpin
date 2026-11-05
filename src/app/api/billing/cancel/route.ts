import { requireOrg, requirePermission } from "@/lib/auth/session";
import { cancelAtPeriodEnd } from "@/lib/billing/lifecycle";
import { requireStripe } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db";
import { json, withApi } from "@/lib/http";
import { enforceRateLimit, RULES } from "@/lib/security/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cancel at the end of the paid period. The second tap lives in the UI; the plan stays on until the date. */
export const POST = withApi(async () => {
  const ctx = await requireOrg();
  requirePermission(ctx, "billing", "manage");
  const db = await getDb();
  await enforceRateLimit(`billing:${ctx.user.id}`, RULES.billing, db);
  const ent = await cancelAtPeriodEnd({ stripe: requireStripe(), db }, ctx.org.id, ctx.user.id);
  return json({ ok: true, cancelAtPeriodEnd: ent.cancelAtPeriodEnd, endsAt: ent.expiresAt });
});
