import { getOrgContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { assertSameOrigin, HttpError, json } from "@/lib/http";
import { consumeOpen } from "@/lib/jobs/meters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const redirect = (to: string) => Response.redirect(to.startsWith("http") ? to : `${appUrl()}${to}`, 303);

/**
 * POST /api/jobs/[id]/open: "Apply at company". Consumes one daily open (free: 5), then sends the browser to the
 * employer's own page. A plain form post (works without JS) gets a 303; fetch() with Accept: application/json gets JSON.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const wantsJson = (req.headers.get("accept") ?? "").includes("application/json");
  const { id } = await params;
  try {
    assertSameOrigin(req);
    const ctx = await getOrgContext();
    if (!ctx) {
      if (wantsJson) throw new HttpError(401, "unauthorized");
      return redirect(`/sign-in?next=${encodeURIComponent(`/job/${id}`)}`);
    }
    const db = await getDb();
    const job = await db.getJob(id);
    if (!job || job.closedAt || !/^https?:\/\//.test(job.applyUrl)) throw new HttpError(404, "not_found");
    const r = await consumeOpen(db, ctx.org.id, job.id);
    if (!r.ok) {
      if (wantsJson) return json({ error: "open_limit", used: r.state.used, limit: r.state.limit }, 402);
      return redirect(`/job/${id}?limit=opens`);
    }
    return wantsJson ? json({ ok: true, applyUrl: job.applyUrl, repeat: r.repeat, used: r.state.used, limit: r.state.limit }) : redirect(job.applyUrl);
  } catch (e) {
    if (e instanceof HttpError) return wantsJson ? json({ error: e.code }, e.status) : redirect(`/job/${id}`);
    throw e;
  }
}
