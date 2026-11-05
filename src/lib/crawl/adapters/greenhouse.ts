import { detectCountry } from '../normalize';
import type { AtsAdapter, BoardRef } from '../types';
import { asRecord, assertSlug, buildJob, fetchBody, mapItems, notModifiedResult, parseDate, parseJson, plainFromHtml, str, type CachedBoardRef } from './common';

export const greenhouse: AtsAdapter = {
  ats: 'greenhouse',
  async crawl(board: BoardRef, fetcher) {
    const b = board as CachedBoardRef;
    const url = `https://boards-api.greenhouse.io/v1/boards/${assertSlug(b.slug)}/jobs?content=true`;
    const r = await fetchBody(fetcher, url, b);
    if (r.notModified) return notModifiedResult(r.etag);
    const data = asRecord(parseJson(r.body));
    const items = Array.isArray(data?.jobs) ? (data.jobs as unknown[]) : [];
    return mapItems(items, (raw) => {
      const j = asRecord(raw);
      if (!j) return null;
      const location = str(asRecord(j.location)?.name);
      return buildJob({
        ats: 'greenhouse',
        externalId: str(j.id),
        title: str(j.title),
        descriptionText: plainFromHtml(str(j.content)),
        location,
        country: detectCountry(location),
        applyUrl: str(j.absolute_url),
        // first_published only; updated_at is never a posted date.
        firstPublishedAt: parseDate(j.first_published),
      });
    }, r.etag);
  },
};
