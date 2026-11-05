import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { assertSameOrigin, HttpError, json } from "@/lib/http";
import { verifyManageToken } from "@/lib/jobs/alertRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manage alerts without signing in. The signed link (`e` + `t`) is the only credential, and it only reaches rules saved under that email. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const form = await req.formData();
    const e = String(form.get("e") ?? "");
    const t = String(form.get("t") ?? "");
    if (!(await verifyManageToken(e, t))) throw new HttpError(403, "invalid_link");
    const db = await getDb();
    const action = String(form.get("action") ?? "");
    const here = `${appUrl()}/alerts/manage?${new URLSearchParams({ e, t, saved: "1" })}`;
    if (action === "delete" || action === "pause" || action === "resume") {
      const rule = (await db.listAlertRulesByEmail(e)).find((r) => r.id === String(form.get("id") ?? ""));
      if (!rule) throw new HttpError(404, "not_found");
      if (action === "delete") await db.deleteAlertRule(rule.orgId, rule.id);
      else await db.saveAlertRule({ ...rule, active: action === "resume" });
    } else if (action === "stop-alerts" || action === "stop-digest") {
      await db.addSuppression({ email: e, scope: action === "stop-alerts" ? "alerts" : "digest", reason: "unsubscribe" });
    } else throw new HttpError(400, "invalid_input");
    return Response.redirect(here, 303);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.code }, err.status);
    throw err;
  }
}
