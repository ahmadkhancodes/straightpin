import { detectCountry } from '../normalize';
import type { AtsAdapter, BoardRef } from '../types';
import { assertSlug, buildJob, fetchBody, mapItems, notModifiedResult, parseDate, plainFromHtml, type CachedBoardRef } from './common';
import { assertSafeXml, getAll, getText } from './xml';

export { UnsafeXmlError } from './xml';

/** JSON /api/offers/ is token gated from 10 Feb 2027, so we read the public XML feed. */
export const recruitee: AtsAdapter = {
  ats: 'recruitee',
  async crawl(board: BoardRef, fetcher) {
    const b = board as CachedBoardRef;
    const slug = assertSlug(b.slug);
    const r = await fetchBody(fetcher, `https://${slug}.recruitee.com/offers.xml`, b);
    if (r.notModified) return notModifiedResult(r.etag);
    assertSafeXml(r.body);
    return mapItems(getAll(r.body, 'offer'), (offer) => {
      const city = getText(offer, 'city');
      const country = getText(offer, 'country');
      const code = getText(offer, 'country_code');
      const location = getText(offer, 'location') ?? ([city, country].filter(Boolean).join(', ') || null);
      const remote = (getText(offer, 'remote') ?? '').toLowerCase() === 'true';
      return buildJob({
        ats: 'recruitee',
        externalId: getText(offer, 'id') ?? getText(offer, 'guid'),
        title: getText(offer, 'title'),
        descriptionText: plainFromHtml(getText(offer, 'description')),
        location,
        region: getText(offer, 'state_name') ?? getText(offer, 'state_code'),
        country: detectCountry(location, code ?? country),
        remoteHints: [remote ? 'remote' : null],
        applyUrl: getText(offer, 'careers_url') ?? getText(offer, 'careers_apply_url'),
        // published_at when present; created_at is the offer creation date.
        firstPublishedAt: parseDate(getText(offer, 'published_at')) ?? parseDate(getText(offer, 'created_at')),
      });
    }, r.etag);
  },
};
