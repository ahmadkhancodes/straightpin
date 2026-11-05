import { detectCountry } from '../normalize';
import type { AtsAdapter, BoardRef } from '../types';
import { asRecord, assertSlug, buildJob, fetchBody, mapItems, notModifiedResult, parseDate, parseJson, plainFromHtml, str, type CachedBoardRef } from './common';

export { RateLimitedError } from './common';

export const workable: AtsAdapter = {
  ats: 'workable',
  async crawl(board: BoardRef, fetcher) {
    const b = board as CachedBoardRef;
    // fetchBody throws RateLimitedError (with Retry-After) on 429; Cloudflare fronts this API.
    const r = await fetchBody(fetcher, `https://apply.workable.com/api/v1/widget/accounts/${assertSlug(b.slug)}`, b);
    if (r.notModified) return notModifiedResult(r.etag);
    const data = asRecord(parseJson(r.body));
    const items = Array.isArray(data?.jobs) ? (data.jobs as unknown[]) : [];
    return mapItems(items, (raw) => {
      const j = asRecord(raw);
      if (!j) return null;
      const city = str(j.city);
      const state = str(j.state);
      const country = str(j.country);
      const location = [city, state, country].filter(Boolean).join(', ') || null;
      return buildJob({
        ats: 'workable',
        externalId: str(j.shortcode) ?? str(j.code),
        title: str(j.title),
        descriptionText: plainFromHtml(str(j.description)),
        location,
        region: state,
        country: detectCountry(location, country),
        remoteHints: [j.telecommuting === true ? 'remote' : null],
        applyUrl: str(j.application_url) ?? str(j.url) ?? str(j.shortlink),
        // published_on is a real publish date; created_at is a creation date. Neither is updated_at.
        firstPublishedAt: parseDate(j.published_on) ?? parseDate(j.created_at),
      });
    }, r.etag);
  },
};
