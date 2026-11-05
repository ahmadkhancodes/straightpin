import { detectCountry, payPeriodFrom } from '../normalize';
import type { AtsAdapter, BoardRef, NormalizedJob, PayPeriod } from '../types';
import { asRecord, assertSlug, buildJob, currencyOf, fetchBody, mapItems, notModifiedResult, num, parseDate, parseJson, str, type CachedBoardRef } from './common';
import type { RemoteType } from '../types';

export interface Comp { payMin: number | null; payMax: number | null; payPeriod: PayPeriod | null; currency: NormalizedJob['currency'] }

function fromSummaryString(s: string): Comp | null {
  const cur = /£/.test(s) ? 'GBP' : /€/.test(s) ? 'EUR' : /C\$|CAD/.test(s) ? 'CAD' : /\$|USD/.test(s) ? 'USD' : null;
  const amounts = [...s.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*([kK])?/g)]
    .map((m) => Number((m[1] ?? '').replace(/,/g, '')) * (m[2] ? 1000 : 1))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!amounts.length) return null;
  const period = payPeriodFrom(s) ?? (Math.min(...amounts) >= 1000 ? 'year' : null);
  return { payMin: Math.min(...amounts), payMax: Math.max(...amounts), payPeriod: period, currency: cur };
}

/** Parse Ashby `compensation`: structured summaryComponents first, then the summary string. */
export function parseAshbyCompensation(comp: unknown): Comp {
  const empty: Comp = { payMin: null, payMax: null, payPeriod: null, currency: null };
  const c = asRecord(comp);
  if (!c) return empty;
  const comps = Array.isArray(c.summaryComponents) ? c.summaryComponents.map(asRecord).filter((x): x is Record<string, unknown> => !!x) : [];
  const salary = comps.find((x) => str(x.compensationType)?.toLowerCase() === 'salary' && (num(x.minValue) !== null || num(x.maxValue) !== null));
  if (salary) {
    const min = num(salary.minValue);
    const max = num(salary.maxValue);
    return {
      payMin: min ?? max,
      payMax: max ?? min,
      payPeriod: payPeriodFrom(str(salary.interval)),
      currency: currencyOf(salary.currencyCode),
    };
  }
  const summary = str(c.scrapeableCompensationSalarySummary) ?? str(c.compensationTierSummary);
  return (summary && fromSummaryString(summary)) || empty;
}

function workplace(j: Record<string, unknown>): RemoteType {
  const w = str(j.workplaceType)?.toLowerCase();
  if (w === 'remote') return 'remote';
  if (w === 'hybrid') return 'hybrid';
  if (w === 'onsite' || w === 'on-site') return 'onsite';
  return j.isRemote === true ? 'remote' : 'unknown';
}

export const ashby: AtsAdapter = {
  ats: 'ashby',
  async crawl(board: BoardRef, fetcher) {
    const b = board as CachedBoardRef;
    const url = `https://api.ashbyhq.com/posting-api/job-board/${assertSlug(b.slug)}?includeCompensation=true`;
    const r = await fetchBody(fetcher, url, b);
    if (r.notModified) return notModifiedResult(r.etag);
    const data = asRecord(parseJson(r.body));
    const items = Array.isArray(data?.jobs) ? (data.jobs as unknown[]) : [];
    return mapItems(items, (raw) => {
      const j = asRecord(raw);
      if (!j || j.isListed === false) return null;
      const location = str(j.location);
      const addr = asRecord(asRecord(j.address)?.postalAddress);
      const comp = parseAshbyCompensation(j.compensation);
      return buildJob({
        ats: 'ashby',
        externalId: str(j.id),
        title: str(j.title),
        descriptionText: str(j.descriptionPlain) ?? '',
        location,
        region: str(addr?.addressRegion),
        country: detectCountry(location, str(addr?.addressCountry)),
        remoteType: workplace(j),
        ...comp,
        applyUrl: str(j.jobUrl) ?? str(j.applyUrl),
        firstPublishedAt: parseDate(j.publishedAt),
      });
    }, r.etag);
  },
};
