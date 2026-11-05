import { headers } from "next/headers";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { getAuth } from "@/lib/auth";
import { requireUser } from "@/lib/auth/session";
import { cancelAppSubscriptions } from "@/lib/billing/entitlement";
import { getStripe } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db";
import { clientIp, json, readJson, withApi } from "@/lib/http";
import { enforceRateLimit, RULES } from "@/lib/security/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ confirm: z.literal("delete my account") });

/**
 * DELETE /api/account (ported trayo DELETE /account): for every org the user OWNS alone, cancel this app's
 * Stripe subscriptions and delete the org's app data + the org; then delete the user (sessions, accounts, keys).
 * The Stripe customer is kept for tax records (BACKEND_REUSE 1.13).
 */
export const DELETE = withApi(async (req) => {
  const { user } = await requireUser();
  await readJson(req, Body);
  const db = await getDb();
  await enforceRateLimit(`account:${user.id}`, RULES.account, db);
  const auth = await getAuth();
  const h = await headers();
  const orgs = (await auth.api.listOrganizations({ headers: h })) as { id: string }[];
  const stripe = getStripe();
  for (const o of orgs) {
    const full = (await auth.api.getFullOrganization({ headers: h, query: { organizationId: o.id } })) as { members?: { userId: string; role: string }[] } | null;
    const members = full?.members ?? [];
    const owners = members.filter((m) => m.role.split(",").includes("owner"));
    const soleOwner = owners.length === 1 && owners[0]!.userId === user.id;
    if (!soleOwner) continue;
    const acct = await db.getBillingAccount(o.id);
    if (stripe && acct?.stripeCustomerId) await cancelAppSubscriptions(stripe, db.app, acct.stripeCustomerId);
    await db.deleteOrgData(o.id);
    await auth.api.deleteOrganization({ headers: h, body: { organizationId: o.id } });
    await audit({ orgId: o.id, actorId: user.id, action: "org.deleted", ip: clientIp(req) });
  }
  await auth.api.deleteUser({ headers: h, body: {} });
  return json({ deleted: true });
});
