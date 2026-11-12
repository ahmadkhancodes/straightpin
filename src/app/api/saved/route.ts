import { z } from "zod";
import { getOrgContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { assertSameOrigin, HttpError, json } from "@/lib/http";
import { saveJobFor, unsaveJobFor } from "@/lib/jobs/meters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ jobId: z.string().min(1).max(64), action: z.enum(["save", "unsave"]).default("save"), next: z.string().optional() });
const safeNext = (n: string | undefined, fallback: string) => (n && /^\/[^/\\]/.test(n) ? n : fallback);

/** POST /api/saved {jobId, action}. Free plan: 10 saves. Works as a plain form post (303 back) or JSON. */
export async function POST(req: Request) {
  const wantsJson = (req.headers.get("content-type") ?? "").includes("application/json");
  try {
    assertSameOrigin(req);
    const raw = wantsJson ? await req.json().catch(() => ({})) : Object.fromEntries((await req.formData().catch(() => new FormData())).entries());
    const body = schema.safeParse(raw);
    if (!body.success) throw new HttpError(400, "invalid_input");
    const { jobId, action } = body.data;
    const back = safeNext(body.data.next, `/job/${jobId}`);
    const ctx = await getOrgContext();
    if (!ctx) {
      if (wantsJson) throw new HttpError(401, "unauthorized");
      return Response.redirect(`${appUrl()}/sign-in?next=${encodeURIComponent(back)}`, 303);
    }
    const db = await getDb();
    if (action === "unsave") {
      await unsaveJobFor(db, ctx.org.id, jobId);
      return wantsJson ? json({ ok: true }) : Response.redirect(`${appUrl()}${back}`, 303);
    }
    if (!(await db.getJob(jobId))) throw new HttpError(404, "not_found");
    const r = await saveJobFor(db, ctx.org.id, jobId);
    if (!r.ok) return wantsJson ? json({ error: "save_limit", used: r.state.used, limit: r.state.limit }, 402) : Response.redirect(`${appUrl()}${back}${back.includes("?") ? "&" : "?"}limit=saves`, 303);
    return wantsJson ? json({ ok: true, created: r.created, used: r.state.used, limit: r.state.limit }) : Response.redirect(`${appUrl()}${back}`, 303);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status);
    throw e;
  }
}
