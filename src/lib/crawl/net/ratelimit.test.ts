import { describe, expect, it } from 'vitest';
import { InMemoryHostLimiter, parseRetryAfterMs, type LimiterClock } from './ratelimit';

function fakeClock(start = 0): LimiterClock & { t: number } {
  const c = {
    t: start,
    now: () => c.t,
    sleep: (ms: number) => { const target = c.t + ms; c.t = Math.max(c.t, target); return Promise.resolve(); },
  };
  return c;
}

describe('InMemoryHostLimiter', () => {
  it('first call is immediate, then spaced at 1 req/s', async () => {
    const clock = fakeClock(10_000);
    const l = new InMemoryHostLimiter(clock);
    expect((await l.acquire('a.test')).waitMs).toBe(0);
    expect((await l.acquire('a.test')).waitMs).toBe(1000);
    expect((await l.acquire('a.test')).waitMs).toBe(1000);
    expect(clock.t).toBe(12_000);
  });
  it('hosts are independent', async () => {
    const l = new InMemoryHostLimiter(fakeClock());
    await l.acquire('a.test');
    expect((await l.acquire('b.test')).waitMs).toBe(0);
  });
  it('honours crawl delay', async () => {
    const l = new InMemoryHostLimiter(fakeClock());
    await l.acquire('a.test', { crawlDelayMs: 5000 });
    expect((await l.acquire('a.test')).waitMs).toBe(5000);
  });
  it('retryAfter pushes nextAllowedAt', async () => {
    const l = new InMemoryHostLimiter(fakeClock());
    await l.acquire('a.test');
    expect((await l.acquire('a.test', { retryAfterMs: 30_000 })).waitMs).toBe(30_000);
  });
  it('caps concurrency at 4 until release', async () => {
    const l = new InMemoryHostLimiter(fakeClock());
    for (let i = 0; i < 4; i++) await l.acquire('a.test');
    let fifth = false;
    const p = l.acquire('a.test').then(() => { fifth = true; });
    await Promise.resolve(); await Promise.resolve();
    expect(fifth).toBe(false);
    l.release('a.test');
    await p;
    expect(fifth).toBe(true);
  });
  it('release never goes negative', async () => {
    const l = new InMemoryHostLimiter(fakeClock());
    l.release('a.test'); l.release('a.test');
    for (let i = 0; i < 4; i++) await l.acquire('a.test');
    let extra = false;
    void l.acquire('a.test').then(() => { extra = true; });
    await Promise.resolve(); await Promise.resolve();
    expect(extra).toBe(false);
  });
});

describe('parseRetryAfterMs', () => {
  it('parses seconds, dates and junk', () => {
    expect(parseRetryAfterMs('12', 0)).toBe(12000);
    expect(parseRetryAfterMs(new Date(5000).toUTCString(), 2000)).toBe(3000);
    expect(parseRetryAfterMs('soon', 0)).toBeNull();
    expect(parseRetryAfterMs(undefined, 0)).toBeNull();
  });
});
