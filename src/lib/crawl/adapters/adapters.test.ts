import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAdapter } from './index';
import { RateLimitedError } from './common';
import { UnsafeXmlError } from './xml';
import { leverUrl } from './lever';
import { parseAshbyCompensation } from './ashby';
import { fakeFetcher } from './__fixtures__/fake-fetcher';
import type { AdapterResult, AtsKind } from '../types';

const fx = (n: string) => readFileSync(join(__dirname, '__fixtures__', n), 'utf8');
const adapter = (a: AtsKind) => { const x = getAdapter(a); if (!x) throw new Error('missing'); return x; };

function expectUnique(r: AdapterResult) {
  const keys = r.jobs.map((j) => `${j.ats}:${j.externalId}`);
  expect(new Set(keys).size).toBe(keys.length);
  for (const j of r.jobs) {
    expect(j.excerpt.length).toBeLessThanOrEqual(600);
    expect(j.country).not.toBeNull();
    expect(j.sourceHost).toBeTruthy();
  }
}

describe('registry', () => {
  it('returns adapters and null for unsupported', () => {
    for (const a of ['greenhouse', 'lever', 'ashby', 'workable', 'recruitee', 'personio'] as const) expect(getAdapter(a)?.ats).toBe(a);
    expect(getAdapter('smartrecruiters')).toBeNull();
  });
});

describe('greenhouse', () => {
  const url = 'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true';
  it('maps jobs, uses first_published, skips bad/non-target', async () => {
    const f = fakeFetcher({ [url]: { body: fx('greenhouse.json'), headers: { etag: 'W/"1"' } } });
    const r = await adapter('greenhouse').crawl({ ats: 'greenhouse', slug: 'acme' }, f);
    expect(f.calls[0]?.url).toBe(url);
    expect(r.etag).toBe('W/"1"');
    expect(r.jobs.map((j) => j.externalId)).toEqual(['4001', '4002', '4004']);
    expect(r.skipped).toBe(3); // Berlin, no id, null
    const [a, b, c] = r.jobs;
    expect(a?.country).toBe('US');
    expect(a?.remoteType).toBe('remote');
    expect(a?.excerpt).toBe('Build great APIs & services.');
    expect(a?.firstPublishedAt?.toISOString()).toBe('2026-09-15T13:30:00.000Z');
    expect(a?.applyUrl).toBe('https://boards.greenhouse.io/acme/jobs/4001');
    expect(a?.sourceHost).toBe('boards.greenhouse.io');
    expect(b?.country).toBe('CA');
    expect(b?.firstPublishedAt).toBeNull(); // updated_at must never be used
    expect(c?.excerpt.length).toBeLessThanOrEqual(600);
    expectUnique(r);
  });
  it('externalId is stable across crawls', async () => {
    const f = fakeFetcher({ [url]: { body: fx('greenhouse.json') } });
    const r1 = await adapter('greenhouse').crawl({ ats: 'greenhouse', slug: 'acme' }, f);
    const r2 = await adapter('greenhouse').crawl({ ats: 'greenhouse', slug: 'acme' }, f);
    expect(r1.jobs.map((j) => j.externalId)).toEqual(r2.jobs.map((j) => j.externalId));
  });
  it('handles 304 and sends the etag', async () => {
    const f = fakeFetcher({ [url]: { status: 304 } });
    const r = await adapter('greenhouse').crawl({ ats: 'greenhouse', slug: 'acme', etag: 'abc' } as never, f);
    expect(r).toMatchObject({ jobs: [], skipped: 0, notModified: true, etag: 'abc' });
    expect(f.calls[0]?.etag).toBe('abc');
  });
  it('survives malformed JSON', async () => {
    const f = fakeFetcher({ [url]: { body: '<html>oops' } });
    const r = await adapter('greenhouse').crawl({ ats: 'greenhouse', slug: 'acme' }, f);
    expect(r.jobs).toEqual([]);
  });
  it('rejects hostile slugs', async () => {
    await expect(adapter('greenhouse').crawl({ ats: 'greenhouse', slug: 'a/../b' }, fakeFetcher({}))).rejects.toThrow();
  });
});

describe('lever', () => {
  it('uses the EU host for region eu', () => {
    expect(leverUrl('acme', 'eu')).toBe('https://api.eu.lever.co/v0/postings/acme?mode=json');
    expect(leverUrl('acme')).toBe('https://api.lever.co/v0/postings/acme?mode=json');
  });
  it('maps postings', async () => {
    const f = fakeFetcher({ [leverUrl('acme', 'eu')]: { body: fx('lever.json') } });
    const r = await adapter('lever').crawl({ ats: 'lever', slug: 'acme', region: 'eu' }, f);
    expect(f.calls[0]?.url).toContain('api.eu.lever.co');
    expect(r.jobs.map((j) => j.externalId)).toEqual(['aaaa-1', 'aaaa-2']);
    expect(r.skipped).toBe(2);
    const a = r.jobs[0];
    expect(a).toMatchObject({ country: 'US', remoteType: 'hybrid', payMin: 180000, payMax: 240000, payPeriod: 'year', currency: 'USD', applyUrl: 'https://jobs.lever.co/acme/aaaa-1' });
    expect(a?.firstPublishedAt?.getTime()).toBe(1760000000000);
    expect(r.jobs[1]?.country).toBe('UK');
    expect(r.jobs[1]?.payMin).toBeNull();
    expectUnique(r);
  });
});

describe('ashby', () => {
  const url = 'https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=true';
  it('maps jobs and compensation', async () => {
    const f = fakeFetcher({ [url]: { body: fx('ashby.json') } });
    const r = await adapter('ashby').crawl({ ats: 'ashby', slug: 'acme' }, f);
    expect(r.jobs.map((j) => j.externalId)).toEqual(['ab-1', 'ab-2', 'ab-4']);
    expect(r.skipped).toBe(2);
    expect(r.jobs[0]).toMatchObject({ country: 'US', remoteType: 'hybrid', payMin: 150000, payMax: 190000, payPeriod: 'year', currency: 'USD', applyUrl: 'https://jobs.ashbyhq.com/acme/ab-1' });
    expect(r.jobs[0]?.firstPublishedAt?.toISOString()).toBe('2026-10-20T12:00:00.000Z');
    expect(r.jobs[1]).toMatchObject({ country: 'CA', remoteType: 'remote', payMin: 60, payMax: 80, payPeriod: 'hour', currency: 'CAD' });
    expect(r.jobs[2]).toMatchObject({ country: 'UK', currency: 'GBP', payMin: 50000 });
    expect(r.jobs[2]?.firstPublishedAt).toBeNull();
    expectUnique(r);
  });
  it('parses compensation variants', () => {
    expect(parseAshbyCompensation(null)).toEqual({ payMin: null, payMax: null, payPeriod: null, currency: null });
    expect(parseAshbyCompensation({ scrapeableCompensationSalarySummary: '$150K - $190K' })).toEqual({ payMin: 150000, payMax: 190000, payPeriod: 'year', currency: 'USD' });
    expect(parseAshbyCompensation({ compensationTierSummary: '£45,000 - £55,000' })).toMatchObject({ payMin: 45000, payMax: 55000, currency: 'GBP' });
    expect(parseAshbyCompensation({ summaryComponents: [{ compensationType: 'Salary', interval: '1 HOUR', currencyCode: 'USD', minValue: 40, maxValue: 55 }] }))
      .toEqual({ payMin: 40, payMax: 55, payPeriod: 'hour', currency: 'USD' });
    expect(parseAshbyCompensation({ summaryComponents: [{ compensationType: 'Bonus', interval: '1 YEAR', minValue: 5, maxValue: 6 }] }).payMin).toBeNull();
  });
});

describe('workable', () => {
  const url = 'https://apply.workable.com/api/v1/widget/accounts/acme';
  it('maps jobs, no salary, created date fallback', async () => {
    const f = fakeFetcher({ [url]: { body: fx('workable.json') } });
    const r = await adapter('workable').crawl({ ats: 'workable', slug: 'acme' }, f);
    expect(r.jobs.map((j) => j.externalId)).toEqual(['ABC123', 'DEF456']);
    expect(r.skipped).toBe(2);
    expect(r.jobs[0]).toMatchObject({ country: 'US', remoteType: 'remote', payMin: null, excerpt: 'Analyse data' });
    expect(r.jobs[0]?.firstPublishedAt?.toISOString()).toContain('2026-10-10');
    expect(r.jobs[1]?.country).toBe('UK');
    expect(r.jobs[1]?.firstPublishedAt?.toISOString()).toContain('2026-10-08');
    expectUnique(r);
  });
  it('throws RateLimitedError with retryAfterMs on 429', async () => {
    const f = fakeFetcher({ [url]: { status: 429, headers: { 'retry-after': '30' } } });
    const err = await adapter('workable').crawl({ ats: 'workable', slug: 'acme' }, f).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitedError);
    expect((err as RateLimitedError).retryAfterMs).toBe(30000);
  });
});

describe('recruitee', () => {
  const url = 'https://acme.recruitee.com/offers.xml';
  it('maps the XML feed', async () => {
    const f = fakeFetcher({ [url]: { body: fx('recruitee.xml') } });
    const r = await adapter('recruitee').crawl({ ats: 'recruitee', slug: 'acme' }, f);
    expect(r.jobs.map((j) => j.externalId)).toEqual(['9001', '9002']);
    expect(r.skipped).toBe(2);
    expect(r.jobs[0]).toMatchObject({ country: 'CA', remoteType: 'remote', excerpt: 'Build UIs', region: 'British Columbia' });
    expect(r.jobs[0]?.firstPublishedAt?.toISOString()).toBe('2026-10-05T08:00:00.000Z');
    expect(r.jobs[1]).toMatchObject({ title: 'Ops & Support', country: 'UK', firstPublishedAt: null });
    expectUnique(r);
  });
  it('refuses DOCTYPE/ENTITY XML', async () => {
    const f = fakeFetcher({ [url]: { body: fx('recruitee-doctype.xml') } });
    await expect(adapter('recruitee').crawl({ ats: 'recruitee', slug: 'acme' }, f)).rejects.toBeInstanceOf(UnsafeXmlError);
  });
});

describe('personio', () => {
  const url = 'https://acme.jobs.personio.de/xml';
  it('maps positions', async () => {
    const f = fakeFetcher({ [url]: { body: fx('personio.xml') } });
    const r = await adapter('personio').crawl({ ats: 'personio', slug: 'acme' }, f);
    expect(r.jobs).toHaveLength(1);
    expect(r.skipped).toBe(2);
    expect(r.jobs[0]).toMatchObject({ externalId: '555', title: 'Backend Engineer', country: 'UK', excerpt: 'Join us', applyUrl: 'https://acme.jobs.personio.de/job/555', sourceHost: 'acme.jobs.personio.de' });
    expect(r.jobs[0]?.firstPublishedAt?.toISOString()).toBe('2026-09-01T10:00:00.000Z');
  });
  it('refuses ENTITY XML', async () => {
    const f = fakeFetcher({ [url]: { body: '<!DOCTYPE x [<!ENTITY a "b">]><workzag-jobs/>' } });
    await expect(adapter('personio').crawl({ ats: 'personio', slug: 'acme' }, f)).rejects.toBeInstanceOf(UnsafeXmlError);
  });
});
