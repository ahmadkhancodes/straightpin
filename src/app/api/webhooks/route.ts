import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireOrg, requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { HttpError, json, readJson, withApi } from "@/lib/http";
import { uuidv7 } from "@/lib/ids";
import { isSafeWebhookUrl, newWebhookSecret } from "@/lib/webhooks/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Create = z.object({ url: z.string().url().max(2048), events: z.array(z.string().min(1).max(64)).min(1).max(50) });

export const GET = withApi(async () => {
  const ctx = await requireOrg();
  requirePermission(ctx, "webhook", "read");
  const eps = await (await getDb()).listWebhookEndpoints(ctx.org.id);
  return json({ endpoints: eps.map(({ secret: _s, ...e }) => e) });
});

export const POST = withApi(async (req) => {
  const ctx = await requireOrg();
  requirePermission(ctx, "webhook", "manage");
  const body = await readJson(req, Create);
  if (!isSafeWebhookUrl(body.url)) throw new HttpError(400, "unsafe_url");
  const db = await getDb();
  if ((await db.listWebhookEndpoints(ctx.org.id)).length >= 20) throw new HttpError(400, "too_many_endpoints");
  const secret = newWebhookSecret();
  const ep = await db.createWebhookEndpoint({ id: uuidv7(), orgId: ctx.org.id, url: body.url, events: body.events, enabled: true, secret });
  await audit({ orgId: ctx.org.id, actorId: ctx.user.id, action: "webhook.created", target: ep.id });
  const { secret: _s, ...endpoint } = ep;
  return json({ endpoint, secret }, 201);
});
