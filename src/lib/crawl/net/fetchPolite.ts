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

/** Redirect hops followed per request (RFC 9309 asks for at least 5 for robots.txt). */
export const MAX_REDIRECTS = 5;

/** The absolute next URL for a 3xx with a Location header, else null. */
export function redirectTarget(res: TransportResponse, from: string): string | null {
  if (![301, 302, 303, 307, 308].includes(res.status)) return null;
  const loc = lowerHeaders(res.headers ?? {})['location'];
  if (!loc) return null;
  try { return new URL(loc, from).toString(); } catch { return null; }
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
    try {
      // RFC 9309: follow up to 5 redirects for robots.txt, each hop through the egress rules.
      let target = `${u.protocol}//${u.host}/robots.txt`;
      let res: TransportResponse | null = null;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const t = assertAllowedHost(target);
        await acquire(t.host);
        try {
          res = await transport(target, { 'User-Agent': USER_AGENT, Accept: 'text/plain,*/*;q=0.5' });
        } finally {
          limiter.release(t.host);
        }
        const next = redirectTarget(res, target);
        if (!next) break;
        target = next;
      }
      // Still redirecting after 5 hops: RFC 9309 treats robots.txt as unavailable (same as a 404).
      rec = res && !redirectTarget(res, target) ? RobotsPolicy.fromResponse(res.status, res.body, now()) : RobotsPolicy.fromResponse(404, '', now());
    } catch {
      rec = RobotsPolicy.fromError(now());
    }
    await robotsStore.put(u.host, rec);
    return rec;
  }

  /** One request to one URL, after the egress rules and robots.txt of that URL's own host. */
  async function fetchOne(req: FetchRequest, url: string): Promise<TransportResponse> {
    const u = assertAllowedHost(url);
    const rec = await robotsFor(u);
    const decision = RobotsPolicy.evaluate(rec, u.pathname + u.search);
    if (!decision.allowed) throw new RobotsDisallowedError(url);

    const headers: Record<string, string> = { Accept: 'application/json, application/xml;q=0.9, */*;q=0.5', ...req.headers, 'User-Agent': USER_AGENT };
    if (url === req.url && req.etag) headers['If-None-Match'] = req.etag;
    if (url === req.url && req.lastModified) headers['If-Modified-Since'] = req.lastModified;

    await acquire(u.host, decision.crawlDelayMs);
    try {
      return await transport(url, headers);
    } finally {
      limiter.release(u.host);
    }
  }

  return {
    async fetch(req: FetchRequest): Promise<FetchResult> {
      // Redirects are followed here, never by the transport, so every hop is checked against the deny list,
      // private addresses and its own host's robots.txt and rate limit (REVIEW P0-3).
      let url = req.url;
      let res = await fetchOne(req, url);
      for (let hop = 0; ; hop++) {
        const next = redirectTarget(res, url);
        if (!next) break;
        if (hop >= MAX_REDIRECTS) throw new Error(`too many redirects: ${req.url}`);
        url = next;
        res = await fetchOne(req, url);
      }
      const u = new URL(url);
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
