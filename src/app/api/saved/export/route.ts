import { getOrgContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { failure, limitRequest } from "@/lib/security/guard";
import { RULES } from "@/lib/security/ratelimit";
import { toCsv } from "@/lib/jobs/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saved/export: the signed in user's saved jobs as a spreadsheet file (CSV).
 * Only the job page link is included, never the employer's apply link, so the daily open meter cannot be skipped.
 */
export async function GET(req: Request) {
  try {
    const ctx = await getOrgContext();
    if (!ctx) return Response.redirect(`${appUrl()}/sign-in?next=${encodeURIComponent("/saved")}`, 303);
    await limitRequest(req, "saved-export", RULES.account, ctx.org.id);
    const db = await getDb();
    const saved = await db.listSaved(ctx.org.id);
    const jobs = new Map((await db.getJobs(saved.map((s) => s.jobId))).map((j) => [j.id, j]));
    const rows: unknown[][] = [["Title", "Company", "Location", "Remote", "Pay", "Posted", "Saved on", "Status", "Link"]];
    for (const s of saved) {
      const j = jobs.get(s.jobId);
      const pay = j?.payMin || j?.payMax ? `${j.currency ?? ""} ${j.payMin ?? ""}${j.payMax && j.payMax !== j.payMin ? `-${j.payMax}` : ""} per ${j.payPeriod ?? ""}`.trim() : "";
      rows.push(j ? [j.title, j.employerName, j.location ?? j.country, j.remoteType, pay, j.postedAt, s.savedAt, j.closedAt ? "Closed" : "Open", `${appUrl()}/job/${j.id}`] : ["(no longer listed)", "", "", "", "", "", s.savedAt, "Removed", ""]);
    }
    return new Response(toCsv(rows), {
      headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store", "content-disposition": `attachment; filename="straightpin-saved-jobs-${new Date().toISOString().slice(0, 10)}.csv"` },
    });
  } catch (e) {
    return failure(e, { wantsJson: false, back: "/saved", route: "/api/saved/export" });
  }
}
