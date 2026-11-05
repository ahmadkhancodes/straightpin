import { env } from "@/lib/env";
import { json } from "@/lib/http";
import { safeEqual } from "@/lib/ids";
import { log } from "@/lib/logger";
import { cronJobs } from "@/lib/cron/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/cron/<job> guarded by CRON_SECRET (Authorization: Bearer <secret>). Called by Vercel Cron
 * (vercel.json) or the Cloudflare Worker template in infra/cron-worker for per-minute schedules.
 */
async function run(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqual(given, secret)) return json({ error: "unauthorized" }, 401);
  const { job } = await params;
  const fn = cronJobs[job];
  if (!fn) return json({ error: "unknown_job" }, 404);
  const started = Date.now();
  try {
    const result = await fn();
    log.info("cron_ok", { route: `cron/${job}`, ms: Date.now() - started });
    return json({ ok: true, job, result, ms: Date.now() - started });
  } catch (e) {
    log.error("cron_failed", { route: `cron/${job}`, message: (e as Error).message });
    return json({ error: "job_failed", job }, 500);
  }
}

export const GET = run;
export const POST = run;
