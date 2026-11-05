import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireOrg, requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { HttpError, json, readJson, withApi } from "@/lib/http";
import { isSafeWebhookUrl } from "@/lib/webhooks/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const Patch = z.object({ url: z.string().url().max(2048).optional(), events: z.array(z.string().min(1).max(64)).min(1).max(50).optional(), enabled: z.boolean().optional() });

export const PATCH = withApi<Ctx>(async (req, { params }) => {
  const ctx = await requireOrg();
  requirePermission(ctx, "webhook", "manage");
  const { id } = await params;
  const body = await readJson(req, Patch);
  if (body.url && !isSafeWebhookUrl(body.url)) throw new HttpError(400, "unsafe_url");
  const db = await getDb();
  if (!(await db.getWebhookEndpoint(ctx.org.id, id))) throw new HttpError(404, "not_found");
  await db.updateWebhookEndpoint(ctx.org.id, id, body);
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "webhook.updated", target: id });
  return json({ updated: true });
});

export const DELETE = withApi<Ctx>(async (_req, { params }) => {
  const ctx = await requireOrg();
  requirePermission(ctx, "webhook", "manage");
  const { id } = await params;
  await (await getDb()).deleteWebhookEndpoint(ctx.org.id, id);
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "webhook.deleted", target: id });
  return json({ deleted: true });
});
