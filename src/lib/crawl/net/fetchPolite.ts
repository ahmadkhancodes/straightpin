import { USER_AGENT, type Fetcher, type FetchRequest, type FetchResult } from '../types';
import { assertAllowedHost } from './egress';
import { parseRetryAfterMs, type HostLimiter } from './ratelimit';
import { RobotsDisallowedError, RobotsPolicy, type RobotsRecord, type RobotsStore } from './robots';

export { RobotsDisallowedError };

export interface TransportResponse { status: number; body: string; headers: Record<string, string> }
export type Transport = (url: string, headers: Record<string, string>) => Promise<TransportResponse>;

export interface FetchPoliteDeps {
  transport: Transport;
  robotsStore: RobotsStore;
  limiter: HostLimiter;
  now: () => number;
  onBlocked?: (host: string) => void;
}

function lowerHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = v;
  return out;
}

export function isBlockedResponse(status: number, body: string, headers: Record<string, string>): boolean {
  if (status === 429) return true;
  const challenge = /just a moment|cf-chl|attention required/i.test(body.slice(0, 20000)) || headers['cf-mitigated'] === 'challenge';
  if (status === 403) return true;
  return challenge && status >= 400;
}

export function createFetchPolite(deps: FetchPoliteDeps): Fetcher {
  const { transport, robotsStore, limiter, now, onBlocked } = deps;
  const pendingRetryAfter = new Map<string, number>();

  async function acquire(host: string, crawlDelayMs?: number): Promise<void> {
    const retryAfterMs = pendingRetryAfter.get(host);
    pendingRetryAfter.delete(host);
    await limiter.acquire(host, { crawlDelayMs, retryAfterMs });
  }

  async function robotsFor(u: URL): Promise<RobotsRecord> {
    const cached = await robotsStore.get(u.host);
    if (cached && RobotsPolicy.isFresh(cached, now())) return cached;
    let rec: RobotsRecord;
    await acquire(u.host);
    try {
      const res = await transport(`${u.protocol}//${u.host}/robots.txt`, { 'User-Agent': USER_AGENT, Accept: 'text/plain,*/*;q=0.5' });
      rec = RobotsPolicy.fromResponse(res.status, res.body, now());
    } catch {
      rec = RobotsPolicy.fromError(now());
    } finally {
      limiter.release(u.host);
    }
    await robotsStore.put(u.host, rec);
    return rec;
  }

  return {
    async fetch(req: FetchRequest): Promise<FetchResult> {
      const u = assertAllowedHost(req.url);
      const rec = await robotsFor(u);
      const decision = RobotsPolicy.evaluate(rec, u.pathname + u.search);
      if (!decision.allowed) throw new RobotsDisallowedError(req.url);

      const headers: Record<string, string> = { Accept: 'application/json, application/xml;q=0.9, */*;q=0.5', ...req.headers, 'User-Agent': USER_AGENT };
      if (req.etag) headers['If-None-Match'] = req.etag;
      if (req.lastModified) headers['If-Modified-Since'] = req.lastModified;

      await acquire(u.host, decision.crawlDelayMs);
      let res: TransportResponse;
      try {
        res = await transport(req.url, headers);
      } finally {
        limiter.release(u.host);
      }
      const rh = lowerHeaders(res.headers ?? {});
      if (res.status === 429) {
        const ra = parseRetryAfterMs(rh['retry-after'], now());
        if (ra !== null) pendingRetryAfter.set(u.host, ra);
      }
      if (isBlockedResponse(res.status, res.body ?? '', rh)) onBlocked?.(u.host);
      return { status: res.status, body: res.status === 304 ? '' : res.body, headers: rh, notModified: res.status === 304 };
    },
  };
}
