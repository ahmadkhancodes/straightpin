import { describe, expect, it } from 'vitest';
import { chooseSitemaps, filterJobUrls, parseSitemap } from './sitemap';
import { fixture } from './fixtures';

describe('parseSitemap', () => {
  it('parses a Workday urlset and decodes entities, dedupes', () => {
    const r = parseSitemap(fixture('workday-sitemap.xml'));
    expect(r.kind).toBe('urlset');
    expect(r.urls).toHaveLength(5);
    expect(r.urls).toContain('https://acme.wd5.myworkdayjobs.com/en-US/External/job/Toronto-ON/Account-Manager_R-1003?source=a&x=1');
  });
  it('parses a sitemapindex', () => {
    const r = parseSitemap(fixture('sitemap-index.xml'));
    expect(r.kind).toBe('sitemapindex');
    expect(r.urls).toEqual(['https://careers.example.com/sitemap-pages.xml', 'https://careers.example.com/sitemap-jobs.xml']);
  });
  it('refuses DOCTYPE and ENTITY', () => {
    expect(parseSitemap(fixture('sitemap-xxe.xml'))).toEqual({ kind: 'refused', urls: [] });
    expect(parseSitemap('<!ENTITY a "b"><urlset></urlset>').kind).toBe('refused');
  });
  it('returns unknown for non sitemap text', () => {
    expect(parseSitemap('<html></html>').kind).toBe('unknown');
  });
});

describe('filterJobUrls', () => {
  it('keeps Workday detail pages, drops the board and search pages', () => {
    const urls = filterJobUrls(parseSitemap(fixture('workday-sitemap.xml')).urls);
    expect(urls).toHaveLength(3);
    expect(urls.every((u) => u.includes('/job/'))).toBe(true);
  });
  it('keeps custom detail pages, drops listings and search', () => {
    const urls = filterJobUrls(parseSitemap(fixture('sitemap-jobs.xml')).urls);
    expect(urls).toEqual([
      'https://careers.example.com/jobs/1001-staff-engineer',
      'https://careers.example.com/jobs/1002-support-lead',
      'https://careers.example.com/jobs/1003-gone',
      'https://careers.example.com/jobs/1004-expired',
    ]);
  });
  it('handles other patterns', () => {
    const out = filterJobUrls([
      'https://x.com/careers/senior-nurse-4411',
      'https://x.com/careers/',
      'https://x.com/positions/abc',
      'https://x.com/opportunities/abc',
      'https://x.com/vacancies/abc',
      'https://x.com/requisition/123',
      'https://x.com/blog/hello',
      'https://x.com/jobs/category/engineering',
      'https://x.com/jobs/2',
      'not a url',
    ]);
    expect(out).toEqual([
      'https://x.com/careers/senior-nurse-4411',
      'https://x.com/positions/abc',
      'https://x.com/opportunities/abc',
      'https://x.com/vacancies/abc',
      'https://x.com/requisition/123',
    ]);
  });
});

describe('chooseSitemaps', () => {
  it('dedupes, drops non http and gz, puts job sitemaps first, caps', () => {
    const out = chooseSitemaps([
      'https://x.com/sitemap.xml',
      'https://x.com/sitemap.xml',
      'ftp://x.com/a.xml',
      'https://x.com/jobs-sitemap.xml',
      'https://x.com/s.xml.gz',
    ]);
    expect(out).toEqual(['https://x.com/jobs-sitemap.xml', 'https://x.com/sitemap.xml']);
    expect(chooseSitemaps(['https://a.com/1', 'https://a.com/2', 'https://a.com/3'], 2)).toHaveLength(2);
  });
});
