import { getDb } from "@/lib/db";
import { fixtureJobs } from "@/lib/jobs/fixtures";
import { json } from "@/lib/http";
import { clearCountCache } from "@/lib/jobs/matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** E2E only: loads invented fixture jobs into the memory driver. 404 unless E2E_OUTBOX=1 (never set on Vercel). */
export async function POST() {
  if (process.env.E2E_OUTBOX !== "1") return json({ error: "not_found" }, 404);
  const now = new Date();
  const r = await (await getDb()).upsertJobs(fixtureJobs(now), now);
  clearCountCache();
  return json({ ok: true, ...r });
}
