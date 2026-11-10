import { getDb } from "@/lib/db";
import { FIELDS, type FieldId } from "./fields";
import { liveCount } from "./matching";

export interface CrawlStats {
  /** Open jobs in the database (agency posts hidden), 0 when none or the database is unreachable. */
  total: number;
  /** When the last crawl finished, or null before the first one. */
  lastCrawlAt: Date | null;
}

/** Real numbers for the home page and /jobs. Never throws: a database outage renders the empty state. */
export async function getCrawlStats(): Promise<CrawlStats> {
  try {
    const db = await getDb();
    const [{ count }, runs] = await Promise.all([liveCount(db, {}), db.listSourceRuns(5)]);
    const last = runs.filter((r) => r.employers > 0).sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime())[0];
    return { total: count, lastCrawlAt: last?.finishedAt ?? null };
  } catch {
    return { total: 0, lastCrawlAt: null };
  }
}

/** "10 Nov 2026, 02:14 UTC" */
export function crawlTimeText(d: Date): string {
  const t = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(d);
  return `${t.replace(",", ",")} UTC`;
}

/** The sentence under the hero and at the top of /jobs, from real data with an honest empty state. */
export function statsLine(s: CrawlStats): string {
  if (s.total <= 0 || !s.lastCrawlAt) return "The first crawl of company hiring pages is filling the job list. Come back soon, or pick your field now and we will email you when jobs match.";
  return `${s.total.toLocaleString("en-US")} open jobs from company hiring pages. Last crawl finished ${crawlTimeText(s.lastCrawlAt)}.`;
}

/** Real match counts per field for the home page chips; null while the job list is empty so the page falls back to labelled examples. */
export async function getFieldCounts(total: number): Promise<Partial<Record<FieldId, { count: number; agencyHidden: number }>> | null> {
  if (total <= 0) return null;
  try {
    const db = await getDb();
    const rows = await Promise.all(FIELDS.map(async (f) => [f.id, await liveCount(db, { field: f.id })] as const));
    return Object.fromEntries(rows);
  } catch {
    return null;
  }
}
