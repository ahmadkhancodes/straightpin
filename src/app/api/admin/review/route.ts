import { requireAdmin } from "@/lib/auth/session";
import { reviewJob } from "@/lib/classify/labels";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { assertSameOrigin, HttpError, json } from "@/lib/http";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirm (agency) or reject (direct) one pending classification. Writes the label, settles the job, then goes back to the queue. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    const form = await req.formData();
    const jobId = String(form.get("jobId") ?? "");
    const label = String(form.get("label") ?? "");
    if (label !== "agency" && label !== "direct") throw new HttpError(400, "invalid_input");
    const db = await getDb();
    const job = await db.getJob(jobId);
    if (!job) throw new HttpError(404, "not_found");
    await reviewJob(db, job, label, admin.email);
    await audit({ orgId: null, actorId: admin.id, action: "admin.agency_label", target: jobId, meta: { label } });
    return Response.redirect(`${appUrl()}/admin/review`, 303);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status);
    throw e;
  }
}
