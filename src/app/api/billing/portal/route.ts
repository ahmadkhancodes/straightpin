import { requireOrg, requirePermission } from "@/lib/auth/session";
import { createPortalSession } from "@/lib/billing/checkout";
import { requireStripe } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { json, withApi } from "@/lib/http";
import { enforceRateLimit, RULES } from "@/lib/security/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async () => {
  const ctx = await requireOrg();
  requirePermission(ctx, "billing", "manage");
  const db = await getDb();
  await enforceRateLimit(`billing:${ctx.user.id}`, RULES.billing, db);
  return json(await createPortalSession(requireStripe(), db, ctx.org.id, `${appUrl()}/app/billing`));
});
