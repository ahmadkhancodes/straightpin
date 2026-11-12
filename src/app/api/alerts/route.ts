import { getOrgContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { assertSameOrigin, HttpError, json } from "@/lib/http";
import { addAlertRule } from "@/lib/jobs/alertRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const back = (q: string) => Response.redirect(`${appUrl()}/alerts${q}`, 303);

/** Signed in users add, pause, resume or delete their saved alerts (plain form post, works without JS). */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ctx = await getOrgContext();
    if (!ctx) return Response.redirect(`${appUrl()}/sign-in?next=${encodeURIComponent("/alerts")}`, 303);
    const db = await getDb();
    const form = await req.formData().catch(() => new FormData());
    const action = String(form.get("action") ?? "add");
    if (action === "add") {
      const r = await addAlertRule(db, { orgId: ctx.org.id, email: ctx.user.email }, { field: form.get("field"), country: form.get("country"), location: form.get("location"), payFloor: form.get("payFloor") }, new Date());
      return r.ok ? back("?added=1") : back(`?error=${r.error}`);
    }
    const id = String(form.get("id") ?? "");
    const rule = (await db.listAlertRules(ctx.org.id)).find((x) => x.id === id);
    if (!rule) throw new HttpError(404, "not_found");
    if (action === "delete") await db.deleteAlertRule(ctx.org.id, id);
    else if (action === "pause" || action === "resume") await db.saveAlertRule({ ...rule, active: action === "resume" });
    else throw new HttpError(400, "invalid_input");
    return back("?saved=1");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status);
    throw e;
  }
}
