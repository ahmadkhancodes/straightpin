import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
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

/** Up/down per dependency, no hostnames, versions or error text. Only the database decides the status code. */
export async function GET() {
  const ok = await dbReachable();
  const e = env();
  const stripe = Boolean(e.STRIPE_SECRET_KEY?.trim() && e.STRIPE_WEBHOOK_SECRET?.trim());
  const mail = e.MAIL_PROVIDER !== "resend" || Boolean(e.RESEND_API_KEY?.trim());
  return json(
    {
      ok,
      db: ok ? "up" : "down",
      billing: stripe ? "configured" : "not_configured",
      mail: mail ? "configured" : "not_configured",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      at: new Date().toISOString(),
    },
    ok ? 200 : 503,
  );
}
