/**
 * Per host politeness limiter: <=1 request/s and <=4 concurrent per host,
 * honouring Crawl-delay and Retry-After.
 *
 * Mongo implementation sketch (not implemented, for the VPS/serverless move):
 * keep one document per host in `host_state` { _id: host, next_allowed_at: Date, active: number }.
 * To reserve a slot, run an atomic
 *   findOneAndUpdate(
 *     { _id: host, active: { $lt: 4 } },
 *     [{ $set: {
 *        start: { $max: ['$$NOW', '$next_allowed_at'] },
 *        active: { $add: ['$active', 1] } } },
 *      { $set: { next_allowed_at: { $add: ['$start', intervalMs] } } }],
 *     { upsert: true, returnDocument: 'before' })
 * and sleep until max(now, previous next_allowed_at). A Retry-After is applied with
 * $max on next_allowed_at = now + retryAfterMs. release() does $inc active -1 (floor 0).
 * Lease the `active` counter with a TTL so crashed workers cannot leak slots.
 */

export interface AcquireOpts { crawlDelayMs?: number; retryAfterMs?: number }
export interface HostLimiter {
  acquire(host: string, opts?: AcquireOpts): Promise<{ waitMs: number }>;
  release(host: string): void;
}

export interface LimiterClock { now(): number; sleep(ms: number): Promise<void> }
export const systemClock: LimiterClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

interface HostState { active: number; nextAllowedAt: number; queue: Array<() => void> }

export class InMemoryHostLimiter implements HostLimiter {
  private hosts = new Map<string, HostState>();
  constructor(
    private clock: LimiterClock = systemClock,
    private cfg: { minIntervalMs: number; maxConcurrent: number } = { minIntervalMs: 1000, maxConcurrent: 4 },
  ) {}

  private state(host: string): HostState {
    const k = host.toLowerCase();
    let s = this.hosts.get(k);
    if (!s) { s = { active: 0, nextAllowedAt: 0, queue: [] }; this.hosts.set(k, s); }
    return s;
  }

  async acquire(host: string, opts: AcquireOpts = {}): Promise<{ waitMs: number }> {
    const st = this.state(host);
    if (st.active >= this.cfg.maxConcurrent) {
      // The slot is handed over by release() without decrementing `active`.
      await new Promise<void>((resolve) => st.queue.push(resolve));
    } else {
      st.active++;
    }
    const now = this.clock.now();
    if (opts.retryAfterMs && opts.retryAfterMs > 0) st.nextAllowedAt = Math.max(st.nextAllowedAt, now + opts.retryAfterMs);
    const start = Math.max(now, st.nextAllowedAt);
    st.nextAllowedAt = start + Math.max(this.cfg.minIntervalMs, opts.crawlDelayMs ?? 0);
    const waitMs = start - now;
    if (waitMs > 0) await this.clock.sleep(waitMs);
    return { waitMs };
  }

  release(host: string): void {
    const st = this.state(host);
    const next = st.queue.shift();
    if (next) next();
    else st.active = Math.max(0, st.active - 1);
  }
}

/** Retry-After header: delta seconds or an HTTP date. Returns ms, or null if unparseable. */
export function parseRetryAfterMs(value: string | undefined | null, nowMs: number): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(Number(v) * 1000);
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : Math.max(0, t - nowMs);
}
