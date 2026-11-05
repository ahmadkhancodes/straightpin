import { requireOrg, requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { json, withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req) => {
  const ctx = await requireOrg();
  requirePermission(ctx, "webhook", "read");
  const endpointId = new URL(req.url).searchParams.get("endpointId") ?? undefined;
  const list = await (await getDb()).listDeliveries(ctx.org.id, { endpointId, limit: 100 });
  return json({ deliveries: list.map(({ payload: _p, ...d }) => d) });
});
