import { describe, expect, it } from 'vitest';
import { applyRules, registrableDomain, parseApply } from './rules';
import { SEED_RULES } from './seed-agencies';
import type { ClassifyInput } from './types';

const base: ClassifyInput = { title: 'Support Specialist', company: 'Fictional Widgets Co', excerpt: 'Answer customer tickets.' };

describe('helpers', () => {
  it('registrableDomain', () => {
    expect(registrableDomain('https://jobs.randstad.com/x')).toBe('randstad.com');
    expect(registrableDomain('www.reed.co.uk')).toBe('reed.co.uk');
    expect(registrableDomain('boards.greenhouse.io/acme')).toBe('greenhouse.io');
    expect(registrableDomain(undefined)).toBe('');
  });
  it('parseApply', () => {
    expect(parseApply('https://jobs.lever.co/acme/123?x=1')).toEqual({ host: 'jobs.lever.co', slug: 'acme' });
  });
});

describe('applyRules', () => {
  it('returns null score with no hits', () => {
    expect(applyRules(base, SEED_RULES)).toEqual({ score: null, hits: [], decisive: false });
  });
  it('known agency apply domain is decisive', () => {
    const r = applyRules({ ...base, applyHost: 'jobs.randstad.com/job/1' }, SEED_RULES);
    expect(r.decisive).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0.95);
  });
  it('known agency name is decisive, single token needs generic suffix only', () => {
    expect(applyRules({ ...base, company: 'Robert Half International' }, SEED_RULES).decisive).toBe(true);
    expect(applyRules({ ...base, company: 'Hays plc' }, SEED_RULES).decisive).toBe(true);
    expect(applyRules({ ...base, company: 'Reed Smith Law Partners' }, SEED_RULES).decisive).toBe(false);
  });
  it('SIC codes are decisive', () => {
    for (const sic of ['7363', '7361', '78100', '78200', '78300']) {
      expect(applyRules({ ...base, sicCode: sic }, SEED_RULES).decisive).toBe(true);
    }
    expect(applyRules({ ...base, sicCode: '5734' }, SEED_RULES).decisive).toBe(false);
  });
  it('decisive hit beats a direct signal', () => {
    const r = applyRules({ ...base, company: 'Adecco', companyDomain: 'adecco.com', applyHost: 'adecco.com/j' }, SEED_RULES);
    expect(r.decisive).toBe(true);
  });
  it('one weak phrase stays in the pending band, more push up', () => {
    const one = applyRules({ ...base, excerpt: 'Our client is hiring.' }, SEED_RULES);
    expect(one.decisive).toBe(false);
    expect(one.score).toBeGreaterThan(0.35);
    expect(one.score).toBeLessThan(0.65);
    const two = applyRules({ ...base, excerpt: 'On behalf of our client, a staffing firm.' }, SEED_RULES);
    expect(two.score).toBeGreaterThanOrEqual(0.65);
    expect(two.hits.length).toBeGreaterThanOrEqual(2);
  });
  it('phrases match on word boundaries', () => {
    expect(applyRules({ ...base, excerpt: 'We value understaffing awareness' }, SEED_RULES).score).toBeNull();
  });
  it('direct: company domain equals apply host', () => {
    const r = applyRules({ ...base, companyDomain: 'fictionalwidgets.com', applyHost: 'careers.fictionalwidgets.com' }, SEED_RULES);
    expect(r.decisive).toBe(false);
    expect(r.score).toBeLessThanOrEqual(0.35);
  });
  it('direct: ATS board slug matches company', () => {
    const r = applyRules({ ...base, applyHost: 'https://boards.greenhouse.io/fictionalwidgets/jobs/9' }, SEED_RULES);
    expect(r.score).toBeLessThanOrEqual(0.35);
    const sub = applyRules({ ...base, company: 'Fictional Widgets', applyHost: 'fictionalwidgets.myworkdayjobs.com' }, SEED_RULES);
    expect(sub.score).toBeLessThanOrEqual(0.35);
  });
  it('ATS slug that does not match the company is not a direct signal', () => {
    expect(applyRules({ ...base, applyHost: 'boards.greenhouse.io/someoneelse' }, SEED_RULES).score).toBeNull();
  });
  it('direct signal lowers a phrase score', () => {
    const r = applyRules({ ...base, excerpt: 'Our client is hiring', applyHost: 'jobs.lever.co/fictionalwidgets' }, SEED_RULES);
    expect(r.score).toBeLessThan(0.5);
  });
});
