import { requireUser, isFounderAdmin } from "@/lib/auth/session";
import { HttpError, json, withApi } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  const { user } = await requireUser();
  if (!isFounderAdmin(user.email)) throw new HttpError(404, "not_found");
  const { adminOverview } = await import("@/lib/admin");
  return json(await adminOverview());
});
