import { getDb } from "@/lib/db";
import { dbDriver } from "@/lib/env";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cheap read against the database, given up after 2 seconds. */
async function dbReachable(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ping = (async () => (await getDb()).hasStripeEvent("health-ping"))();
    ping.catch(() => undefined);
    await Promise.race([ping, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("timeout")), 2000); })]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const ok = await dbReachable();
  return json(
    { ok, db: dbDriver(), version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev", at: new Date().toISOString() },
    ok ? 200 : 503,
  );
}
