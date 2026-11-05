import { describe, expect, it } from 'vitest';
import { extractJobPostings, jobPostingToNormalized } from './jsonld';
import { fixture } from './fixtures';

const PAGE = 'https://careers.example.com/jobs/1001-staff-engineer';

describe('extractJobPostings', () => {
  it('finds JobPosting inside @graph with array @type', () => {
    const posts = extractJobPostings(fixture('custom-graph.html'));
    expect(posts).toHaveLength(1);
    expect(posts[0]?.['title']).toBe('Staff Engineer (Platform)');
  });
  it('handles top level arrays', () => {
    expect(extractJobPostings(fixture('telecommute.html'))).toHaveLength(1);
  });
  it('skips invalid JSON without throwing and keeps valid scripts', () => {
    const posts = extractJobPostings(fixture('invalid-json.html'));
    expect(posts).toHaveLength(1);
    expect(posts[0]?.['title']).toBe('Valid Analyst');
  });
  it('returns [] for no scripts, garbage, and non job types', () => {
    expect(extractJobPostings('<html></html>')).toEqual([]);
    expect(extractJobPostings('<script type="application/ld+json">not json</script>')).toEqual([]);
    expect(extractJobPostings('<script type="application/ld+json">{"@type":"Organization"}</script>')).toEqual([]);
  });
  it('finds nested postings', () => {
    const h = '<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"@type":"ListItem","item":{"@type":"JobPosting","title":"A"}}]}</script>';
    expect(extractJobPostings(h)).toHaveLength(1);
  });
});

describe('jobPostingToNormalized', () => {
  it('maps a full custom site posting', () => {
    const raw = extractJobPostings(fixture('custom-graph.html'))[0]!;
    const job = jobPostingToNormalized(raw, PAGE)!;
    expect(job.ats).toBe('jsonld');
    expect(job.externalId).toBe('R-1001');
    expect(job.titleNorm).toBe('staff engineer');
    expect(job.country).toBe('US');
    expect(job.region).toBe('TX');
    expect(job.location).toBe('Austin, TX, US');
    expect(job.remoteType).toBe('unknown');
    expect(job.payMin).toBe(150000);
    expect(job.payMax).toBe(190000);
    expect(job.payPeriod).toBe('year');
    expect(job.currency).toBe('USD');
    expect(job.applyUrl).toBe('https://careers.example.com/jobs/1001-staff-engineer');
    expect(job.sourceHost).toBe('careers.example.com');
    expect(job.excerpt).toContain('Build the platform & ship it.');
    expect(job.excerpt).not.toContain('<');
    expect(job.firstPublishedAt?.toISOString()).toBe('2026-10-05T00:00:00.000Z'); // not dateModified
    expect(job.validThrough?.toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });
  it('maps TELECOMMUTE to remote with applicant country and monthly pay', () => {
    const raw = extractJobPostings(fixture('telecommute.html'))[0]!;
    const job = jobPostingToNormalized(raw, 'https://careers.example.com/jobs/csm')!;
    expect(job.remoteType).toBe('remote');
    expect(job.country).toBe('US');
    expect(job.payPeriod).toBe('month');
    expect(job.payMin).toBe(6500);
    expect(job.payMax).toBe(6500);
    expect(job.applyUrl).toBe('https://careers.example.com/jobs/csm');
  });
  it('maps UK hourly single value', () => {
    const raw = extractJobPostings(fixture('invalid-json.html'))[0]!;
    const job = jobPostingToNormalized(raw, PAGE)!;
    expect(job.country).toBe('UK');
    expect(job.payPeriod).toBe('hour');
    expect(job.payMin).toBe(18.5);
    expect(job.currency).toBe('GBP');
  });
  it('returns null for non US/CA/UK, missing title, and unknown location', () => {
    const de = { '@type': 'JobPosting', title: 'Dev', jobLocation: { address: { addressLocality: 'Berlin', addressCountry: 'DE' } } };
    expect(jobPostingToNormalized(de, PAGE)).toBeNull();
    expect(jobPostingToNormalized({ '@type': 'JobPosting' }, PAGE)).toBeNull();
    expect(jobPostingToNormalized({ '@type': 'JobPosting', title: 'Dev' }, PAGE)).toBeNull();
  });
  it('gives null datePosted when absent and ignores dateModified', () => {
    const raw = { '@type': 'JobPosting', title: 'Dev', dateModified: '2026-11-01', jobLocation: { address: { addressCountry: 'US', addressLocality: 'Austin' } } };
    expect(jobPostingToNormalized(raw, PAGE)!.firstPublishedAt).toBeNull();
  });
});
