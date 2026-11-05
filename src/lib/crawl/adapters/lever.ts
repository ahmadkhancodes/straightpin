import { detectCountry, payPeriodFrom } from '../normalize';
import type { AtsAdapter, BoardRef, Country } from '../types';
import { asRecord, assertSlug, buildJob, currencyOf, fetchBody, mapItems, notModifiedResult, num, parseDate, parseJson, str, type CachedBoardRef } from './common';
import type { RemoteType } from '../types';

export function leverUrl(slug: string, region?: 'eu' | 'us'): string {
  const host = region === 'eu' ? 'api.eu.lever.co' : 'api.lever.co';
  return `https://${host}/v0/postings/${assertSlug(slug)}?mode=json`;
}

function countryFromCode(code: string | null): Country | null {
  const c = (code ?? '').toUpperCase();
  if (c === 'US') return 'US';
  if (c === 'CA') return 'CA';
  if (c === 'GB' || c === 'UK') return 'UK';
  return null;
}

function workplace(v: string | null): RemoteType {
  if (v === 'remote') return 'remote';
  if (v === 'hybrid') return 'hybrid';
  if (v === 'on-site' || v === 'onsite') return 'onsite';
  return 'unknown';
}

export const lever: AtsAdapter = {
  ats: 'lever',
  async crawl(board: BoardRef, fetcher) {
    const b = board as CachedBoardRef;
    const r = await fetchBody(fetcher, leverUrl(b.slug, b.region), b);
    if (r.notModified) return notModifiedResult(r.etag);
    const data = parseJson(r.body);
    const items = Array.isArray(data) ? (data as unknown[]) : [];
    return mapItems(items, (raw) => {
      const j = asRecord(raw);
      if (!j) return null;
      const cats = asRecord(j.categories);
      const location = str(cats?.location);
      const sal = asRecord(j.salaryRange);
      return buildJob({
        ats: 'lever',
        externalId: str(j.id),
        title: str(j.text),
        descriptionText: str(j.descriptionPlain) ?? '',
        location,
        // Lever's ISO country code is more reliable than free text; fall back to text.
        country: countryFromCode(str(j.country)) ?? detectCountry(location, str(j.country) && str(j.country)!.length > 2 ? str(j.country) : null),
        remoteType: workplace(str(j.workplaceType)),
        payMin: sal ? num(sal.min) : null,
        payMax: sal ? num(sal.max) : null,
        payPeriod: sal ? payPeriodFrom(str(sal.interval)) : null,
        currency: sal ? currencyOf(sal.currency) : null,
        applyUrl: str(j.hostedUrl),
        firstPublishedAt: parseDate(typeof j.createdAt === 'number' ? j.createdAt : num(j.createdAt)),
      });
    }, r.etag);
  },
};
