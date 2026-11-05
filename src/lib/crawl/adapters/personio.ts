import { detectCountry } from '../normalize';
import type { AtsAdapter, BoardRef } from '../types';
import { assertSlug, buildJob, fetchBody, mapItems, notModifiedResult, parseDate, plainFromHtml, type CachedBoardRef } from './common';
import { assertSafeXml, getAll, getText } from './xml';

export const personio: AtsAdapter = {
  ats: 'personio',
  async crawl(board: BoardRef, fetcher) {
    const b = board as CachedBoardRef;
    const slug = assertSlug(b.slug);
    const r = await fetchBody(fetcher, `https://${slug}.jobs.personio.de/xml`, b);
    if (r.notModified) return notModifiedResult(r.etag);
    assertSafeXml(r.body);
    return mapItems(getAll(r.body, 'position'), (pos) => {
      const descBlock = getAll(pos, 'jobDescriptions').join(' ');
      const top = pos.replace(/<jobDescriptions>[\s\S]*?<\/jobDescriptions>/g, '');
      const desc = getAll(descBlock, 'value').map((v) => plainFromHtml(getText(`<value>${v}</value>`, 'value'))).join(' ');
      const id = getText(top, 'id');
      const office = getText(top, 'office');
      return buildJob({
        ats: 'personio',
        externalId: id,
        title: getText(top, 'name'),
        descriptionText: desc,
        location: office,
        country: detectCountry(office),
        applyUrl: id ? `https://${slug}.jobs.personio.de/job/${encodeURIComponent(id)}` : null,
        // createdAt is the position creation timestamp, used as the posted date.
        firstPublishedAt: parseDate(getText(top, 'createdAt')),
      });
    }, r.etag);
  },
};
