import { describe, expect, it } from 'vitest';
import { DIM, featurize, fnv1a } from './features';
import type { ClassifyInput } from './types';

const input: ClassifyInput = {
  title: 'Customer Support Rep',
  company: 'Fictional Widgets Co',
  applyHost: 'jobs.lever.co/fictionalwidgets',
  excerpt: 'Answer tickets, help customers, and keep them happy.',
};

describe('featurize', () => {
  it('fnv1a known vectors', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
  });
  it('is deterministic', () => {
    expect([...featurize(input)]).toEqual([...featurize({ ...input })]);
  });
  it('indices in range, L2 normalised', () => {
    const f = featurize(input);
    let s = 0;
    for (const [i, v] of f) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(DIM);
      s += v * v;
    }
    expect(s).toBeCloseTo(1, 10);
  });
  it('uses signed values', () => {
    const vals = [...featurize(input).values()];
    expect(vals.some((v) => v < 0)).toBe(true);
    expect(vals.some((v) => v > 0)).toBe(true);
  });
  it('different text gives different vectors; empty input gives empty vector', () => {
    expect([...featurize({ ...input, excerpt: 'Our client is a leading staffing firm' })]).not.toEqual([...featurize(input)]);
    expect(featurize({ title: '', company: '', excerpt: '' }).size).toBe(0);
  });
  it('idf scales features', () => {
    const plain = featurize(input);
    const [firstIdx] = [...plain.keys()];
    const idf = new Map<number, number>([[firstIdx as number, 5]]);
    const scaled = featurize(input, idf);
    expect(Math.abs(scaled.get(firstIdx as number) as number)).toBeGreaterThan(Math.abs(plain.get(firstIdx as number) as number));
  });
});
