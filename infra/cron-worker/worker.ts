/**
 * Cloudflare Worker cron template: calls /api/cron/<job> every minute (Vercel Hobby allows 1 cron/day).
 * Deploy: cd infra/cron-worker && npx wrangler secret put CRON_SECRET && npx wrangler deploy
 */
interface Env { APP_URL: string; CRON_SECRET: string; JOBS: string; HOURLY_JOBS?: string; DAILY_JOBS?: string }

export default {
  async scheduled(event: { scheduledTime?: number }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    // JOBS run every minute; HOURLY_JOBS (digest, alerts) only in the first minute of each hour.
    // DAILY_JOBS (source-health, retention) run at 03:00 UTC.
    const at = new Date(event.scheduledTime ?? Date.now());
    const minute = at.getUTCMinutes();
    const list = [env.JOBS, minute === 0 ? env.HOURLY_JOBS ?? "" : "", minute === 0 && at.getUTCHours() === 3 ? env.DAILY_JOBS ?? "" : ""].join(",");
    for (const job of list.split(",").map((s) => s.trim()).filter(Boolean)) {
      ctx.waitUntil(
        fetch(`${env.APP_URL}/api/cron/${job}`, { method: "POST", headers: { authorization: `Bearer ${env.CRON_SECRET}` } })
          .then((r) => { if (!r.ok) console.error(`cron ${job} -> ${r.status}`); }),
      );
    }
  },
};
