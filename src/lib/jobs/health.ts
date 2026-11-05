import type { EmployerDoc, SourceRun } from "./types";

export interface SourceHealth {
  employerId: string;
  name: string;
  ats: string;
  status: EmployerDoc["status"];
  /** Crawls in the sampled runs, and how many worked. */
  runs: number;
  ok: number;
  /** 0..1, null when the board was not crawled in the sampled runs. */
  successRate: number | null;
  lastCrawledAt: Date | null;
  added: number;
  closed: number;
  lastError: string | null;
  disabledReason: string | null;
  verified: boolean | null;
}

export interface CrawlHealth {
  sources: SourceHealth[];
  runs: number;
  lastRunAt: Date | null;
  added: number;
  closed: number;
  overallSuccessRate: number | null;
}

/** Pure: per source success rate, last crawl and jobs added/closed over the sampled runs (newest first or any order). */
export function crawlHealth(employers: EmployerDoc[], runs: SourceRun[]): CrawlHealth {
  const by = new Map<string, SourceHealth>();
  for (const e of employers)
    by.set(e.id, { employerId: e.id, name: e.name, ats: e.ats, status: e.status, runs: 0, ok: 0, successRate: null, lastCrawledAt: e.lastCrawledAt, added: 0, closed: 0, lastError: null, disabledReason: e.disabledReason ?? null, verified: e.verified ?? null });
  const newestFirst = [...runs].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  for (const r of newestFirst) {
    for (const b of r.boards ?? []) {
      const h = by.get(b.employerId);
      if (!h) continue;
      h.runs++;
      if (b.ok) h.ok++;
      h.added += b.inserted;
      h.closed += b.closed;
    }
    for (const err of r.errors) {
      const h = by.get(err.employerId);
      if (h && !h.lastError) h.lastError = err.message.slice(0, 160);
    }
  }
  let runsTotal = 0;
  let okTotal = 0;
  for (const h of by.values()) {
    h.successRate = h.runs ? h.ok / h.runs : null;
    runsTotal += h.runs;
    okTotal += h.ok;
  }
  return {
    sources: [...by.values()].sort((a, b) => (a.successRate ?? 2) - (b.successRate ?? 2) || a.name.localeCompare(b.name)),
    runs: runs.length,
    lastRunAt: newestFirst[0]?.startedAt ?? null,
    added: runs.reduce((n, r) => n + r.inserted, 0),
    closed: runs.reduce((n, r) => n + r.closed, 0),
    overallSuccessRate: runsTotal ? okTotal / runsTotal : null,
  };
}
