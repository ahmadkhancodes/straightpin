import { getDb } from "@/lib/db";
import { json } from "@/lib/http";
import { HttpError } from "@/lib/http";
import { failure, limitRequest } from "@/lib/security/guard";
import { RULES } from "@/lib/security/ratelimit";
import { liveCount, partialAnswers, queryFromAnswers } from "@/lib/jobs/matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/counts?field=support&country=US ... : live count for the quiz (leading answers only). Public, cached 60 s per instance. */
export async function GET(req: Request) {
  try {
    await limitRequest(req, "counts", RULES.publicRead);
    const p = new URL(req.url).searchParams;
    const db = await getDb();
    const { count, agencyHidden } = await liveCount(db, queryFromAnswers(partialAnswers((k) => p.get(k))));
    return json({ count, agencyHidden }, 200, { "cache-control": "public, max-age=30, s-maxage=60" });
  } catch (e) {
    return failure(e instanceof HttpError ? e : new HttpError(503, "unavailable"), { wantsJson: true, route: "/api/counts" });
  }
}
