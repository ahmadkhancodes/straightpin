import { describe, expect, it } from 'vitest';
import { agencyReceipt, createClassifier, NO_SIGNAL_SCORE } from './classify';
import { SEED_RULES } from './seed-agencies';
import { AGENCY_NO_THRESHOLD, AGENCY_YES_THRESHOLD, flagForScore } from './types';
import type { AgencyModel, ClassifyInput } from './types';

const base: ClassifyInput = { title: 'Admin Assistant', company: 'Fictional Widgets Co', excerpt: 'Help our office run.' };
const fixed = (p: number): AgencyModel => ({ predict: () => p });

describe('band policy', () => {
  it('edges: >= 0.65 yes, <= 0.35 no, between pending', () => {
    expect(AGENCY_YES_THRESHOLD).toBe(0.65);
    expect(AGENCY_NO_THRESHOLD).toBe(0.35);
    expect(flagForScore(0.65)).toBe('yes');
    expect(flagForScore(0.6499)).toBe('pending');
    expect(flagForScore(0.35)).toBe('no');
    expect(flagForScore(0.3501)).toBe('pending');
    expect(flagForScore(0)).toBe('no');
    expect(flagForScore(1)).toBe('yes');
  });
});

describe('createClassifier without model', () => {
  const classify = createClassifier({ rules: SEED_RULES });
  it('no signals => no', () => {
    const r = classify(base);
    expect(r.score).toBe(NO_SIGNAL_SCORE);
    expect(r.flag).toBe('no');
  });
  it('weak phrase => pending', () => {
    expect(classify({ ...base, excerpt: 'Our client needs help.' }).flag).toBe('pending');
  });
  it('decisive => yes with reasons', () => {
    const r = classify({ ...base, company: 'TEKsystems', applyHost: 'teksystems.com/x' });
    expect(r.flag).toBe('yes');
    expect(r.reasons.join(' ')).toContain('teksystems.com');
  });
});

describe('createClassifier with model', () => {
  it('decisive rules win over the model', () => {
    const c = createClassifier({ rules: SEED_RULES, model: fixed(0.01) });
    expect(c({ ...base, sicCode: '7363' }).flag).toBe('yes');
  });
  it('model score used when no rules fire', () => {
    expect(createClassifier({ rules: SEED_RULES, model: fixed(0.9) })(base).flag).toBe('yes');
    expect(createClassifier({ rules: SEED_RULES, model: fixed(0.1) })(base).flag).toBe('no');
    expect(createClassifier({ rules: SEED_RULES, model: fixed(0.5) })(base).flag).toBe('pending');
  });
  it('soft phrase hits raise the model score, direct signals lower it', () => {
    const c = createClassifier({ rules: SEED_RULES, model: fixed(0.5) });
    expect(c({ ...base, excerpt: 'on behalf of our client, staffing' }).score).toBeGreaterThan(0.65);
    expect(c({ ...base, applyHost: 'jobs.lever.co/fictionalwidgets' }).score).toBeLessThan(0.35);
  });
});

describe('agencyReceipt', () => {
  it('pluralises', () => {
    expect(agencyReceipt(41)).toBe('We removed 41 staffing agency posts from this list.');
    expect(agencyReceipt(1)).toBe('We removed 1 staffing agency post from this list.');
    expect(agencyReceipt(0)).toBe('We removed 0 staffing agency posts from this list.');
  });
});
