import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireOrg, requirePermission } from "@/lib/auth/session";
import { createCheckoutSession } from "@/lib/billing/checkout";
import { requireStripe } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { flagOn, getFlags } from "@/lib/flags";
import { HttpError, json, readJson, withApi } from "@/lib/http";
import { enforceRateLimit, RULES } from "@/lib/security/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ plan: z.enum(["starter", "pro", "agency"]), interval: z.enum(["month", "year"]) });

export const POST = withApi(async (req) => {
  const ctx = await requireOrg();
  requirePermission(ctx, "billing", "manage");
  if (!flagOn(await getFlags(), "payments_enabled")) throw new HttpError(503, "payments_disabled");
  const body = await readJson(req, Body);
  const db = await getDb();
  await enforceRateLimit(`billing:${ctx.user.id}`, RULES.billing, db);
  const base = appUrl();
  const r = await createCheckoutSession(requireStripe(), db, { orgId: ctx.org.id, email: ctx.user.email, userId: ctx.user.id }, body.plan, body.interval, {
    success: `${base}/app/billing?checkout=success`,
    cancel: `${base}/app/billing?checkout=canceled`,
  });
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "billing.checkout_started", target: `${body.plan}:${body.interval}` });
  return json(r);
});
