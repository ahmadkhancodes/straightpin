import { requireOrg, requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { HttpError, json, withApi } from "@/lib/http";
import { DELIVERY_TTL_DAYS } from "@/lib/db/types";
import { uuidv7 } from "@/lib/ids";
import { attemptDelivery } from "@/lib/webhooks/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const ctx = await requireOrg();
  requirePermission(ctx, "webhook", "manage");
  const { id } = await params;
  const db = await getDb();
  const ep = await db.getWebhookEndpoint(ctx.org.id, id);
  if (!ep) throw new HttpError(404, "not_found");
  const now = new Date();
  const did = uuidv7();
  const d = {
    id: did, app: db.app, orgId: ctx.org.id, endpointId: ep.id, event: "test.ping",
    payload: JSON.stringify({ id: did, type: "test.ping", created: Math.floor(now.getTime() / 1000), data: { message: "Test event" } }),
    status: "pending" as const, attempts: 0, nextAttemptAt: now, lastStatusCode: null, lastError: null,
    createdAt: now, updatedAt: now, expireAt: new Date(now.getTime() + DELIVERY_TTL_DAYS * 864e5),
  };
  await db.createDelivery(d);
  const delivery = await attemptDelivery(d, ep, { db, now });
  const { payload: _p, ...rest } = delivery;
  return json({ delivery: rest });
});
