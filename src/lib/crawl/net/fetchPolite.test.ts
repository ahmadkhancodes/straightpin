import { describe, expect, it, vi } from 'vitest';
import { USER_AGENT } from '../types';
import { EgressBlockedError } from './egress';
import { createFetchPolite, type Transport } from './fetchPolite';
import { InMemoryHostLimiter, type HostLimiter } from './ratelimit';
import { InMemoryRobotsStore, RobotsDisallowedError } from './robots';

type Reply = { status: number; body?: string; headers?: Record<string, string> };

function setup(routes: Record<string, Reply | (() => Reply)>, opts: { limiter?: HostLimiter } = {}) {
  const clock = { t: 1_000_000 };
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const transport: Transport = async (url, headers) => {
    calls.push({ url, headers });
    const r = routes[url];
    if (!r) return { status: 404, body: '', headers: {} };
    const x = typeof r === 'function' ? r() : r;
    return { status: x.status, body: x.body ?? '', headers: x.headers ?? {} };
  };
  const limiter = opts.limiter ?? new InMemoryHostLimiter({ now: () => clock.t, sleep: async (ms) => { clock.t += ms; } });
  const onBlocked = vi.fn();
  const fetcher = createFetchPolite({ transport, robotsStore: new InMemoryRobotsStore(), limiter, now: () => clock.t, onBlocked });
  return { fetcher, calls, onBlocked, clock };
}

describe('fetchPolite', () => {
  it('checks robots once, sends UA, returns body', async () => {
    const { fetcher, calls } = setup({
      'https://a.test/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /private' },
      'https://a.test/x': { status: 200, body: 'hi', headers: { ETag: 'e1' } },
      'https://a.test/y': { status: 200, body: 'yo' },
    });
    const r = await fetcher.fetch({ url: 'https://a.test/x' });
    await fetcher.fetch({ url: 'https://a.test/y' });
    expect(r).toMatchObject({ status: 200, body: 'hi', notModified: false, headers: { etag: 'e1' } });
    expect(calls.filter((c) => c.url.endsWith('/robots.txt'))).toHaveLength(1);
    expect(calls[1]?.headers['User-Agent']).toBe(USER_AGENT);
  });
  it('refetches robots after 24h', async () => {
    const { fetcher, calls, clock } = setup({ 'https://a.test/robots.txt': { status: 404 }, 'https://a.test/x': { status: 200, body: 'x' } });
    await fetcher.fetch({ url: 'https://a.test/x' });
    clock.t += 24 * 3600 * 1000 + 1;
    await fetcher.fetch({ url: 'https://a.test/x' });
    expect(calls.filter((c) => c.url.endsWith('/robots.txt'))).toHaveLength(2);
  });
  it('throws RobotsDisallowedError and does not request the url', async () => {
    const { fetcher, calls } = setup({ 'https://a.test/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /private' } });
    await expect(fetcher.fetch({ url: 'https://a.test/private/1' })).rejects.toBeInstanceOf(RobotsDisallowedError);
    expect(calls.map((c) => c.url)).toEqual(['https://a.test/robots.txt']);
  });
  it('5xx robots disallows all', async () => {
    const { fetcher } = setup({ 'https://a.test/robots.txt': { status: 500 } });
    await expect(fetcher.fetch({ url: 'https://a.test/x' })).rejects.toBeInstanceOf(RobotsDisallowedError);
  });
  it('robots 404 allows', async () => {
    const { fetcher } = setup({ 'https://a.test/x': { status: 200, body: 'ok' } });
    expect((await fetcher.fetch({ url: 'https://a.test/x' })).body).toBe('ok');
  });
  it('asserts egress before any network call', async () => {
    const { fetcher, calls } = setup({});
    await expect(fetcher.fetch({ url: 'https://www.indeed.com/jobs' })).rejects.toBeInstanceOf(EgressBlockedError);
    expect(calls).toHaveLength(0);
  });
  it('sends conditional headers and maps 304', async () => {
    const { fetcher, calls } = setup({ 'https://a.test/x': { status: 304 } });
    const r = await fetcher.fetch({ url: 'https://a.test/x', etag: '"e"', lastModified: 'Mon, 01 Jan 2026 00:00:00 GMT' });
    expect(r.notModified).toBe(true);
    const h = calls[1]?.headers;
    expect(h?.['If-None-Match']).toBe('"e"');
    expect(h?.['If-Modified-Since']).toBe('Mon, 01 Jan 2026 00:00:00 GMT');
  });
  it('does not let callers override the User-Agent', async () => {
    const { fetcher, calls } = setup({ 'https://a.test/x': { status: 200 } });
    await fetcher.fetch({ url: 'https://a.test/x', headers: { 'User-Agent': 'evil' } });
    expect(calls[1]?.headers['User-Agent']).toBe(USER_AGENT);
  });
  it('marks host blocked on challenge, 403 and 429 but returns the result', async () => {
    const { fetcher, onBlocked } = setup({
      'https://a.test/c': { status: 403, body: '<title>Just a moment...</title>' },
      'https://a.test/t': { status: 429, headers: { 'Retry-After': '10' } },
      'https://a.test/ok': { status: 200, body: 'fine' },
    });
    expect((await fetcher.fetch({ url: 'https://a.test/c' })).status).toBe(403);
    expect((await fetcher.fetch({ url: 'https://a.test/t' })).status).toBe(429);
    expect(onBlocked).toHaveBeenCalledTimes(2);
    expect(onBlocked).toHaveBeenCalledWith('a.test');
    await fetcher.fetch({ url: 'https://a.test/ok' });
    expect(onBlocked).toHaveBeenCalledTimes(2);
  });
  it('detects a cf-chl challenge served as 503', async () => {
    const { fetcher, onBlocked } = setup({ 'https://a.test/c': { status: 503, body: '<script>window._cf_chl_opt={}</script> cf-chl' } });
    await fetcher.fetch({ url: 'https://a.test/c' });
    expect(onBlocked).toHaveBeenCalled();
  });
  it('respects robots Crawl-delay and Retry-After via the limiter', async () => {
    const acquired: Array<{ host: string; crawlDelayMs?: number; retryAfterMs?: number }> = [];
    const limiter: HostLimiter = { acquire: async (host, o) => { acquired.push({ host, ...o }); return { waitMs: 0 }; }, release: () => {} };
    const { fetcher } = setup({
      'https://a.test/robots.txt': { status: 200, body: 'User-agent: *\nCrawl-delay: 4' },
      'https://a.test/x': { status: 429, headers: { 'retry-after': '7' } },
      'https://a.test/y': { status: 200 },
    }, { limiter });
    await fetcher.fetch({ url: 'https://a.test/x' });
    await fetcher.fetch({ url: 'https://a.test/y' });
    expect(acquired.at(-2)?.crawlDelayMs).toBe(4000);
    expect(acquired.at(-1)).toMatchObject({ crawlDelayMs: 4000, retryAfterMs: 7000 });
  });
  it('releases the limiter slot when transport throws', async () => {
    const release = vi.fn();
    const limiter: HostLimiter = { acquire: async () => ({ waitMs: 0 }), release };
    const fetcher = createFetchPolite({
      transport: async (url) => { if (url.endsWith('robots.txt')) return { status: 404, body: '', headers: {} }; throw new Error('boom'); },
      robotsStore: new InMemoryRobotsStore(), limiter, now: () => 0,
    });
    await expect(fetcher.fetch({ url: 'https://a.test/x' })).rejects.toThrow('boom');
    expect(release).toHaveBeenCalledTimes(2);
  });
});
