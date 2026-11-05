import type { Db } from "@/lib/db/types";

/**
 * How long we keep things. The /about/data page prints these numbers (retentionStatement), the
 * `retention` cron enforces them, and retention.test.ts fails if the page and the code drift apart.
 */
export const RETENTION = {
  /** A job the company took down is deleted this many days after we saw it close. */
  closedJobDays: 90,
  /** Crawl run records (what we fetched and how it went) are deleted after this many days. */
  crawlRecordDays: 30,
} as const;
export const CRAWL_RECORD_DAYS = RETENTION.crawlRecordDays;

const DAY = 86_400_000;

/** The sentences /about/data shows. Built from RETENTION so the claim cannot differ from the code. */
export function retentionStatement(): { closedJobs: string; crawlRecords: string } {
  return {
    closedJobs: `When a company takes a job down, we keep the closed job for ${RETENTION.closedJobDays} days so saved lists and old links still make sense. Then we delete it, and it leaves every saved list.`,
    crawlRecords: `Crawl records, which hold what we fetched and how each fetch went, are deleted after ${RETENTION.crawlRecordDays} days.`,
  };
}

export interface RetentionResult { closedJobs: number; crawlRecords: number; cutoffs: { closedJobs: string; crawlRecords: string } }

/** Daily cron. Idempotent: running it twice removes nothing more. */
export async function runRetention(db: Db, now: Date): Promise<RetentionResult> {
  const closedBefore = new Date(now.getTime() - RETENTION.closedJobDays * DAY);
  const runsBefore = new Date(now.getTime() - RETENTION.crawlRecordDays * DAY);
  const [closedJobs, crawlRecords] = [await db.purgeClosedJobs(closedBefore), await db.purgeSourceRuns(runsBefore)];
  return { closedJobs, crawlRecords, cutoffs: { closedJobs: closedBefore.toISOString(), crawlRecords: runsBefore.toISOString() } };
}
