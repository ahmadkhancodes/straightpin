import { detectRemoteType, excerptOf, hostOf, htmlToText, normTitle } from '../normalize';
import { parseRetryAfterMs } from '../net/ratelimit';
import type { AdapterResult, AtsKind, BoardRef, Country, Fetcher, NormalizedJob, PayPeriod, RemoteType } from '../types';

export class RateLimitedError extends Error {
  constructor(public readonly url: string, public readonly retryAfterMs: number | null) {
    super(`rate limited: ${url}`);
    this.name = 'RateLimitedError';
  }
}
export class AdapterHttpError extends Error {
  constructor(public readonly url: string, public readonly status: number) {
    super(`http ${status}: ${url}`);
    this.name = 'AdapterHttpError';
  }
}

/** BoardRef plus optional validators from the previous crawl (BoardRef itself is a shared contract). */
export type CachedBoardRef = BoardRef & { etag?: string; lastModified?: string };

export type FetchedBody = { notModified: true; etag?: string } | { notModified: false; body: string; etag?: string };

export async function fetchBody(fetcher: Fetcher, url: string, board: CachedBoardRef): Promise<FetchedBody> {
  const res = await fetcher.fetch({ url, etag: board.etag, lastModified: board.lastModified });
  const etag = res.headers['etag'] ?? res.headers['ETag'] ?? board.etag;
  if (res.notModified || res.status === 304) return { notModified: true, etag };
  if (res.status === 429) throw new RateLimitedError(url, parseRetryAfterMs(res.headers['retry-after'] ?? res.headers['Retry-After'], Date.now()));
  if (res.status < 200 || res.status >= 300) throw new AdapterHttpError(url, res.status);
  return { notModified: false, body: res.body, etag };
}

export function notModifiedResult(etag?: string): AdapterResult {
  return { jobs: [], skipped: 0, etag, notModified: true };
}

export function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = typeof v === 'number' ? new Date(v) : typeof v === 'string' ? new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}( UTC)?$/.test(v) ? v.replace(' UTC', '').replace(' ', 'T') + 'Z' : v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

export function str(v: unknown): string | null {
  if (typeof v === 'string') { const t = v.trim(); return t || null; }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

export function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function currencyOf(v: unknown): NormalizedJob['currency'] {
  const c = typeof v === 'string' ? v.trim().toUpperCase() : '';
  return c === 'USD' || c === 'CAD' || c === 'GBP' || c === 'EUR' ? c : null;
}

/** Plain text from HTML that may be entity-escaped once (Greenhouse). */
export function plainFromHtml(html: string | null | undefined): string {
  if (!html) return '';
  const unescaped = /&lt;\s*\/?[a-z]/i.test(html) && !/<[a-z]/i.test(html)
    ? html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    : html;
  return htmlToText(unescaped);
}

export interface JobDraft {
  ats: AtsKind;
  externalId: string | null;
  title: string | null;
  descriptionText?: string | null;
  location: string | null;
  region?: string | null;
  country: Country | null;
  remoteType?: RemoteType;
  remoteHints?: Array<string | null | undefined>;
  payMin?: number | null;
  payMax?: number | null;
  payPeriod?: PayPeriod | null;
  currency?: NormalizedJob['currency'];
  applyUrl: string | null;
  firstPublishedAt?: Date | null;
  validThrough?: Date | null;
}

/** Returns null when the draft is malformed or its country is not US/CA/UK. */
export function buildJob(d: JobDraft): NormalizedJob | null {
  if (!d.externalId || !d.title || !d.applyUrl || !d.country) return null;
  const host = hostOf(d.applyUrl);
  if (!host) return null;
  const remoteType = d.remoteType && d.remoteType !== 'unknown' ? d.remoteType : detectRemoteType(d.location, d.title, ...(d.remoteHints ?? []));
  return {
    ats: d.ats,
    externalId: d.externalId,
    title: d.title,
    titleNorm: normTitle(d.title),
    excerpt: excerptOf(d.descriptionText ?? ''),
    country: d.country,
    region: d.region ?? null,
    location: d.location,
    remoteType,
    payMin: d.payMin ?? null,
    payMax: d.payMax ?? null,
    payPeriod: d.payPeriod ?? null,
    currency: d.currency ?? null,
    applyUrl: d.applyUrl,
    sourceHost: host,
    firstPublishedAt: d.firstPublishedAt ?? null,
    validThrough: d.validThrough ?? null,
  };
}

/** Maps raw items, skipping (never throwing for) bad ones. */
export function mapItems<T>(items: readonly T[], fn: (item: T) => NormalizedJob | null, etag?: string): AdapterResult {
  const jobs: NormalizedJob[] = [];
  let skipped = 0;
  for (const item of items) {
    try {
      const j = fn(item);
      if (j) jobs.push(j); else skipped++;
    } catch { skipped++; }
  }
  return { jobs, skipped, etag };
}

export function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function parseJson(body: string): unknown {
  try { return JSON.parse(body); } catch { return null; }
}

/** Slug sanity: adapters build hostnames/paths from it. */
export function assertSlug(slug: string): string {
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(slug)) throw new Error(`invalid board slug: ${slug}`);
  return slug;
}
