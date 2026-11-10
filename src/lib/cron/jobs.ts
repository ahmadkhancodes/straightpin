import { getDb } from "@/lib/db";
import { log } from "@/lib/logger";
import { runRenewalReminders } from "@/lib/billing/reminders";
import { runAlerts, runDigest } from "@/lib/jobs/digest";
import { politeFetcher, runCrawlTick } from "@/lib/jobs/crawlTick";
import { runRetention } from "@/lib/jobs/retention";
import { runSourceHealthCheck } from "@/lib/jobs/sourceHealth";
import { retryDueDeliveries } from "@/lib/webhooks/outbound";

/** Run steps one after another; one failing step is recorded and does not stop the next. */
async function sequence(steps: Record<string, () => Promise<unknown>>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(steps)) {
    try {
      out[name] = await fn();
    } catch (e) {
      log.error("cron_step_failed", { step: name, message: (e as Error).message });
      out[name] = { error: "step_failed" };
    }
  }
  return out;
}

const crawl = async () => runCrawlTick({ db: await getDb(), fetcher: politeFetcher() });
const sourceHealth = async () => runSourceHealthCheck(await getDb(), new Date());
const retention = async () => runRetention(await getDb(), new Date());
const digest = async () => runDigest(await getDb(), new Date());
const alerts = async () => runAlerts(await getDb(), new Date());
const renewals = async () => runRenewalReminders(await getDb(), new Date());
const webhooks = () => retryDueDeliveries({ limit: 100 });

/**
 * Register cron jobs here. Each must be idempotent. Production is Vercel Hobby: two daily entries in vercel.json,
 * 60 s each (maxDuration), so each entry folds the jobs that must run at least daily:
 * - `crawl-tick` (first): the crawl loops leased shards for about 40 s, then the source health check and retention.
 * - `webhook-retries` (second): webhook retries, then the email jobs (digest, alerts, renewal reminders), which use the crawl's fresh jobs.
 * The single jobs stay callable by name for a faster scheduler (infra/cron-worker) and for manual runs.
 */
export const cronJobs: Record<string, () => Promise<unknown>> = {
  "crawl-tick": async () => sequence({ crawl, "source-health": sourceHealth, retention }),
  "webhook-retries": async () => sequence({ webhooks, digest, alerts, "renewal-reminders": renewals }),
  heartbeat: async () => ({ at: new Date().toISOString() }),
  /** Single jobs. */
  crawl,
  webhooks,
  digest,
  alerts,
  "renewal-reminders": renewals,
  "source-health": sourceHealth,
  retention,
};
