/**
 * Cloudflare Worker cron template: calls /api/cron/<job> every minute (Vercel Hobby allows 1 cron/day).
 * Deploy: cd infra/cron-worker && npx wrangler secret put CRON_SECRET && npx wrangler deploy
 */
interface Env { APP_URL: string; CRON_SECRET: string; JOBS: string }

export default {
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    for (const job of env.JOBS.split(",").map((s) => s.trim()).filter(Boolean)) {
      ctx.waitUntil(
        fetch(`${env.APP_URL}/api/cron/${job}`, { method: "POST", headers: { authorization: `Bearer ${env.CRON_SECRET}` } })
          .then((r) => { if (!r.ok) console.error(`cron ${job} -> ${r.status}`); }),
      );
    }
  },
};
