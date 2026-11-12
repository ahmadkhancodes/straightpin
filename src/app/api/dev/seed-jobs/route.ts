import { getDb } from "@/lib/db";
import { fixtureJobs, pageFixtureJobs } from "@/lib/jobs/fixtures";
import { json } from "@/lib/http";
import { clearCountCache } from "@/lib/jobs/matching";
import { clearPagesCache } from "@/lib/jobs/seoPages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** E2E only: loads invented fixture jobs into the memory driver. 404 unless E2E_OUTBOX=1 (never set on Vercel). */
export async function POST(req: Request) {
  if (process.env.E2E_OUTBOX !== "1") return json({ error: "not_found" }, 404);
  const now = new Date();
  // ?pages=1 adds enough invented jobs for the programmatic /jobs pages (Toronto and remote support, 10 each).
  const extra = new URL(req.url).searchParams.get("pages") === "1" ? pageFixtureJobs(now) : [];
  const r = await (await getDb()).upsertJobs([...fixtureJobs(now), ...extra], now);
  clearCountCache();
  clearPagesCache();
  return json({ ok: true, ...r });
}
