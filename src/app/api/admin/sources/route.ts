import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { assertSameOrigin, HttpError, json } from "@/lib/http";
import { reenableSource } from "@/lib/jobs/sourceHealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Put a disabled or dead source back into the crawl, then return to the crawl health page. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    const form = await req.formData();
    const id = String(form.get("employerId") ?? "");
    if (!id) throw new HttpError(400, "invalid_input");
    if (!(await reenableSource(await getDb(), id, new Date()))) throw new HttpError(404, "not_found");
    await audit({ orgId: null, actorId: admin.id, action: "admin.source_enabled", target: id });
    return Response.redirect(`${appUrl()}/admin/crawl`, 303);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status);
    throw e;
  }
}
