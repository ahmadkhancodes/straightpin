import { getOrgContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { assertSameOrigin, HttpError, json } from "@/lib/http";
import { failure, limitRequest } from "@/lib/security/guard";
import { RULES } from "@/lib/security/ratelimit";
import { consumeOpen } from "@/lib/jobs/meters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const redirect = (to: string) => Response.redirect(to.startsWith("http") ? to : `${appUrl()}${to}`, 303);

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
function interstitial(employer: string, url: string) {
  return new Response(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>Apply at ${esc(employer)}</title><body style="font-family:system-ui;max-width:560px;margin:64px auto;padding:0 16px"><main><h1>Your link to ${esc(employer)}</h1><p>This opens the company's own page. It is already counted.</p><p><a href="${esc(url)}" rel="noopener noreferrer" style="display:inline-block;min-height:44px;line-height:44px;padding:0 20px;font-weight:600;background:#b3260e;color:#fff;border-radius:8px;text-decoration:none">Apply at ${esc(employer)}</a></p><p><a href="/matches">Back to my matches</a></p></main></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

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
    await limitRequest(req, "open", RULES.userAction, ctx.org.id);
    const db = await getDb();
    if (await db.isSuspended(ctx.org.id)) throw new HttpError(403, "account_suspended");
    const job = await db.getJob(id);
    if (!job || job.closedAt || !/^https?:\/\//.test(job.applyUrl)) throw new HttpError(404, "not_found");
    const r = await consumeOpen(db, ctx.org.id, job.id);
    if (!r.ok) {
      if (wantsJson) return json({ error: "open_limit", used: r.state.used, limit: r.state.limit }, 402);
      return redirect(`/paywall?reason=opens&from=${encodeURIComponent(`/job/${id}`)}`);
    }
    if (wantsJson) return json({ ok: true, applyUrl: job.applyUrl, repeat: r.repeat, used: r.state.used, limit: r.state.limit });
    // Without JavaScript: CSP `form-action` stops a form post from being redirected to the employer, which would
    // leave the button silently dead. A plain link is not restricted, so hand the person the link instead.
    return interstitial(job.employerName, job.applyUrl);
  } catch (e) {
    if (e instanceof HttpError && e.status !== 429 && !wantsJson) return redirect(`/job/${id}`);
    return failure(e, { wantsJson, back: `/job/${encodeURIComponent(id)}`, route: "/api/jobs/open" });
  }
}
