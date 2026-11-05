import { getDb } from "@/lib/db";
import { runAlerts, runDigest } from "@/lib/jobs/digest";
import { politeFetcher, runCrawlTick } from "@/lib/jobs/crawlTick";
import { retryDueDeliveries } from "@/lib/webhooks/outbound";

/** Register cron jobs here. Each must be idempotent and finish well inside maxDuration (60 s). */
export const cronJobs: Record<string, () => Promise<unknown>> = {
  "webhook-retries": () => retryDueDeliveries({ limit: 100 }),
  heartbeat: async () => ({ at: new Date().toISOString() }),
  /** Every few minutes: leases a shard of the source list and crawls it within a 40 s budget. */
  "crawl-tick": async () => runCrawlTick({ db: await getDb(), fetcher: politeFetcher() }),
  /** Hourly: free users whose local time is 08:00 get their daily digest. */
  digest: async () => runDigest(await getDb(), new Date()),
  /** Hourly: paid users get new matches since their last alert. */
  alerts: async () => runAlerts(await getDb(), new Date()),
};
