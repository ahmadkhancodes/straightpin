import { getFlags } from "@/lib/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public remote flags (no secrets, no per-user data). Ported trayo GET /config. */
export async function GET() {
  return new Response(JSON.stringify(await getFlags()), {
    headers: { "content-type": "application/json", "cache-control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
