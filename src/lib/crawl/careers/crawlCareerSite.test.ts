import { describe, expect, it } from 'vitest';
import type { FetchRequest, FetchResult, Fetcher } from '../types';
import { crawlCareerSite } from './crawlCareerSite';
import { fixture } from './fixtures';

const NOW = new Date('2026-11-05T12:00:00Z');
const ok = (body: string): FetchResult => ({ status: 200, body, headers: {}, notModified: false });
const st = (status: number, body = ''): FetchResult => ({ status, body, headers: {}, notModified: false });

function fake(map: Record<string, FetchResult>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async fetch(req: FetchRequest) {
      calls.push(req.url);
      return map[req.url] ?? st(404);
    },
  };
}

const H = 'https://careers.example.com';
const jobPage = (title: string, extra = ''): string =>
  `<script type="application/ld+json">{"@type":"JobPosting","title":"${title}","datePosted":"2026-11-01",${extra}"jobLocation":{"address":{"addressLocality":"Austin","addressRegion":"TX","addressCountry":"US"}}}</script>`;

describe('crawlCareerSite', () => {
  it('follows sitemapindex, fetches job pages, sorts closed and expired', async () => {
    const f = fake({
      [`${H}/sitemap.xml`]: ok(fixture('sitemap-index.xml')),
      [`${H}/sitemap-pages.xml`]: ok('<urlset><url><loc>https://careers.example.com/about</loc></url></urlset>'),
      [`${H}/sitemap-jobs.xml`]: ok(fixture('sitemap-jobs.xml')),
      [`${H}/jobs/1001-staff-engineer`]: ok(fixture('custom-graph.html')),
      [`${H}/jobs/1002-support-lead`]: ok(fixture('invalid-json.html')),
      [`${H}/jobs/1003-gone`]: st(410),
      [`${H}/jobs/1004-expired`]: ok(fixture('expired.html')),
    });
    const r = await crawlCareerSite({ host: 'careers.example.com', robotsSitemaps: [`${H}/sitemap.xml`], fetcher: f, now: NOW });
    expect(r.blocked).toBe(false);
    expect(r.jobs.map((j) => j.externalId).sort()).toEqual(['R-1001', `${H}/jobs/1002-support-lead`].sort());
    expect(r.closedUrls.sort()).toEqual([`${H}/jobs/1003-gone`, `${H}/jobs/1004-expired`]);
    expect(f.calls).not.toContain(`${H}/jobs/search`);
  });

  it('falls back to /sitemap.xml when robots lists none', async () => {
    const f = fake({ [`${H}/sitemap.xml`]: ok(fixture('sitemap-jobs.xml')), [`${H}/jobs/1001-staff-engineer`]: ok(fixture('custom-graph.html')) });
    const r = await crawlCareerSite({ host: 'careers.example.com', robotsSitemaps: [], fetcher: f, now: NOW });
    expect(r.jobs).toHaveLength(1);
  });

  it('stops immediately on a bot challenge in a job page', async () => {
    const f = fake({
      [`${H}/sitemap.xml`]: ok(fixture('sitemap-jobs.xml')),
      [`${H}/jobs/1001-staff-engineer`]: ok(fixture('custom-graph.html')),
      [`${H}/jobs/1002-support-lead`]: st(403, fixture('challenge.html')),
    });
    const r = await crawlCareerSite({ host: 'careers.example.com', robotsSitemaps: [`${H}/sitemap.xml`], fetcher: f, now: NOW });
    expect(r.blocked).toBe(true);
    expect(r.jobs).toHaveLength(1);
    expect(f.calls).toEqual([`${H}/sitemap.xml`, `${H}/jobs/1001-staff-engineer`, `${H}/jobs/1002-support-lead`]); // no retry, no further pages
  });

  it('marks blocked when the sitemap itself is challenged', async () => {
    const f = fake({ [`${H}/sitemap.xml`]: st(503, 'Please complete the captcha') });
    const r = await crawlCareerSite({ host: 'careers.example.com', robotsSitemaps: [`${H}/sitemap.xml`], fetcher: f, now: NOW });
    expect(r).toEqual({ jobs: [], closedUrls: [], blocked: true });
    expect(f.calls).toHaveLength(1);
  });

  it('a plain 403 without challenge text is not blocked', async () => {
    const f = fake({ [`${H}/sitemap.xml`]: st(403, 'Forbidden') });
    const r = await crawlCareerSite({ host: 'careers.example.com', robotsSitemaps: [`${H}/sitemap.xml`], fetcher: f, now: NOW });
    expect(r.blocked).toBe(false);
  });

  it('respects maxUrls', async () => {
    const urls = Array.from({ length: 10 }, (_, i) => `<url><loc>${H}/jobs/${2000 + i}-role</loc></url>`).join('');
    const map: Record<string, FetchResult> = { [`${H}/sitemap.xml`]: ok(`<urlset>${urls}</urlset>`) };
    for (let i = 0; i < 10; i++) map[`${H}/jobs/${2000 + i}-role`] = ok(jobPage(`Role ${i}`, `"identifier":"id${i}",`));
    const f = fake(map);
    const r = await crawlCareerSite({ host: 'careers.example.com', robotsSitemaps: [`${H}/sitemap.xml`], fetcher: f, maxUrls: 3, now: NOW });
    expect(r.jobs).toHaveLength(3);
    expect(f.calls.length).toBe(4);
  });

  it('does not follow sitemap indexes deeper than depth 2', async () => {
    const idx = (u: string): string => `<sitemapindex><sitemap><loc>${u}</loc></sitemap></sitemapindex>`;
    const f = fake({
      [`${H}/sitemap.xml`]: ok(idx(`${H}/l1.xml`)),
      [`${H}/l1.xml`]: ok(idx(`${H}/l2.xml`)),
      [`${H}/l2.xml`]: ok(idx(`${H}/l3.xml`)),
      [`${H}/l3.xml`]: ok('<urlset></urlset>'),
    });
    await crawlCareerSite({ host: 'careers.example.com', robotsSitemaps: [`${H}/sitemap.xml`], fetcher: f, now: NOW });
    expect(f.calls).toEqual([`${H}/sitemap.xml`, `${H}/l1.xml`, `${H}/l2.xml`]);
  });

  it('ignores job URLs on foreign hosts and refused sitemaps', async () => {
    const f = fake({
      [`${H}/sitemap.xml`]: ok('<urlset><url><loc>https://evil.example.net/jobs/1-x</loc></url></urlset>'),
    });
    const r = await crawlCareerSite({ host: 'careers.example.com', robotsSitemaps: [`${H}/sitemap.xml`], fetcher: f, now: NOW });
    expect(f.calls).toHaveLength(1);
    expect(r.jobs).toHaveLength(0);
    const f2 = fake({ [`${H}/sitemap.xml`]: ok(fixture('sitemap-xxe.xml')) });
    await crawlCareerSite({ host: 'careers.example.com', robotsSitemaps: [`${H}/sitemap.xml`], fetcher: f2, now: NOW });
    expect(f2.calls).toHaveLength(1);
  });
});
