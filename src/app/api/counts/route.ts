import { getDb } from "@/lib/db";
import { json } from "@/lib/http";
import { liveCount, partialAnswers, queryFromAnswers } from "@/lib/jobs/matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/counts?field=support&country=US ... : live count for the quiz (leading answers only). Public, cached 60 s per instance. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const db = await getDb();
  const { count, agencyHidden } = await liveCount(db, queryFromAnswers(partialAnswers((k) => p.get(k))));
  return json({ count, agencyHidden }, 200, { "cache-control": "public, max-age=30, s-maxage=60" });
}
