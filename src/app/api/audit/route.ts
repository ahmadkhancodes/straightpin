import { requireOrg, requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { json, withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req) => {
  const ctx = await requireOrg();
  requirePermission(ctx, "audit", "read");
  const b = new URL(req.url).searchParams.get("before");
  const before = b && !Number.isNaN(Date.parse(b)) ? new Date(b) : undefined;
  return json({ entries: await (await getDb()).listAudit(ctx.org.id, { limit: 50, before }) });
});
