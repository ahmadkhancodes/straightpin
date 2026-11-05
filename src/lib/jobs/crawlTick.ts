import type { Fetcher } from "@/lib/crawl/types";
import { createFetchPolite } from "@/lib/crawl/net/fetchPolite";
import { InMemoryHostLimiter } from "@/lib/crawl/net/ratelimit";
import { InMemoryRobotsStore } from "@/lib/crawl/net/robots";
import type { Db } from "@/lib/db/types";
import { uuidv7 } from "@/lib/ids";
import { ingestEmployer, type Classifier, type EmployerOutcome } from "./ingest";
import sources from "./sources.json";
import { httpTransport } from "./transport";
import type { EmployerDoc, EmployerSeed, SourceRun } from "./types";

/** Serverless limit is 60 s (maxDuration). Stop starting work at 40 s, a board fetch times out after 8 s. */
export const TICK_BUDGET_MS = 40_000;
export const SHARD_SIZE = 6;
export const CONCURRENCY = 3;
export const LEASE_TTL_MS = 90_000;
/** Do not start another board with less than this left. */
const MIN_REMAINING_MS = 12_000;

/** Insert the seed list (insert only: existing rows keep their crawl state). */
export async function seedSources(db: Db, now: Date): Promise<number> {
  let created = 0;
  for (const s of sources.sources as EmployerSeed[]) if (await db.upsertEmployer(s, now, true)) created++;
  return created;
}

/** Claim up to `size` due employers. A key is claimed by one owner at a time, so overlapping ticks take different shards. */
export async function leaseShard(db: Db, owner: string, now: Date, size = SHARD_SIZE, ttlMs = LEASE_TTL_MS): Promise<EmployerDoc[]> {
  const candidates = await db.dueEmployers(now, size * 4);
  const got: EmployerDoc[] = [];
  for (const c of candidates) {
    if (got.length >= size) break;
    if (await db.tryLease(c.id, owner, now, ttlMs)) got.push(c);
  }
  return got;
}

export function politeFetcher(): Fetcher {
  return createFetchPolite({ transport: httpTransport(), robotsStore: new InMemoryRobotsStore(), limiter: new InMemoryHostLimiter(), now: () => Date.now() });
}

export interface TickDeps {
  db: Db;
  fetcher: Fetcher;
  now?: () => Date;
  classify?: Classifier;
  budgetMs?: number;
  shardSize?: number;
  concurrency?: number;
}

/** One cron invocation: seed, lease a shard, crawl within the time budget, release leases, record a source run. */
export async function runCrawlTick(deps: TickDeps): Promise<SourceRun> {
  const { db, fetcher } = deps;
  const clock = deps.now ?? (() => new Date());
  const budget = deps.budgetMs ?? TICK_BUDGET_MS;
  const t0 = clock();
  await seedSources(db, t0);
  const owner = uuidv7();
  const shard = await leaseShard(db, owner, t0, deps.shardSize ?? SHARD_SIZE);
  const queue = [...shard];
  const outcomes: EmployerOutcome[] = [];
  let budgetHit = false;
  const worker = async () => {
    for (;;) {
      const remaining = budget - (clock().getTime() - t0.getTime());
      const next = queue.shift();
      if (!next) return;
      if (remaining < MIN_REMAINING_MS) { budgetHit = true; await db.releaseLease(next.id, owner); continue; }
      try {
        outcomes.push(await ingestEmployer({ db, fetcher, now: clock(), classify: deps.classify }, next));
      } finally {
        await db.releaseLease(next.id, owner);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(deps.concurrency ?? CONCURRENCY, shard.length) }, worker));
  const run: SourceRun = {
    id: uuidv7(),
    kind: "crawl-tick",
    startedAt: t0,
    finishedAt: clock(),
    employers: outcomes.length,
    jobsSeen: outcomes.reduce((n, o) => n + o.seen, 0),
    inserted: outcomes.reduce((n, o) => n + o.inserted, 0),
    updated: outcomes.reduce((n, o) => n + o.updated, 0),
    closed: outcomes.reduce((n, o) => n + o.closed, 0),
    agencyHidden: outcomes.reduce((n, o) => n + o.agencyHidden, 0),
    errors: outcomes.filter((o) => o.error).map((o) => ({ employerId: o.employerId, message: o.error! })),
    budgetHit,
  };
  await db.recordSourceRun(run);
  return run;
}
