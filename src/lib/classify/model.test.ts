import { describe, expect, it } from 'vitest';
import { createClassifier } from './classify';
import { DIM, featurize } from './features';
import { loadModel } from './model';
import type { ModelJson } from './model';
import { SEED_RULES } from './seed-agencies';
import type { ClassifyInput } from './types';

describe('LogisticModel', () => {
  it('sigmoid(bias) with empty features', () => {
    const m = loadModel({ version: 't', dim: DIM, bias: 0, weights: {} });
    expect(m.predict(new Map())).toBeCloseTo(0.5, 12);
    expect(loadModel({ version: 't', dim: DIM, bias: 2, weights: {} }).predict(new Map())).toBeCloseTo(1 / (1 + Math.exp(-2)), 12);
  });
  it('applies sparse weights', () => {
    const m = loadModel(JSON.stringify({ version: 't', dim: DIM, bias: -1, weights: { '5': 4 } }));
    expect(m.predict(new Map([[5, 1]]))).toBeCloseTo(1 / (1 + Math.exp(-3)), 12);
    expect(m.predict(new Map([[6, 1]]))).toBeCloseTo(1 / (1 + Math.exp(1)), 12);
  });
  it('rejects bad json', () => {
    expect(() => loadModel({ version: 't', dim: 10, bias: 0, weights: {} })).toThrow();
    expect(() => loadModel({ version: 't', dim: DIM, bias: 0, weights: { '70000': 1 } })).toThrow();
    expect(() => loadModel('{}')).toThrow();
  });
  it('round trips through toJSON', () => {
    const json: ModelJson = { version: 'v1', dim: DIM, bias: 0.3, weights: { '1': 0.5, '9': -2 }, idf: { '1': 2 } };
    expect(loadModel(json).toJSON()).toEqual(json);
  });
  it('is numerically stable for large magnitudes', () => {
    const m = loadModel({ version: 't', dim: DIM, bias: -1000, weights: {} });
    expect(m.predict(new Map())).toBe(0);
  });
});

describe('benchmark', () => {
  it('classifies 1000 jobs in < 20 ms mean', () => {
    // Deterministic pseudo-random sparse weights (LCG), ~20k non-zero.
    let s = 12345;
    const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0);
    const weights: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) weights[String(next() & (DIM - 1))] = (next() / 4294967296 - 0.5) * 2;
    const model = loadModel({ version: 'bench', dim: DIM, bias: 0, weights });
    const classify = createClassifier({ rules: SEED_RULES, model });
    const words = ['team', 'customer', 'support', 'office', 'client', 'manage', 'schedule', 'report', 'remote', 'benefits', 'growth', 'ticket'];
    const jobs: ClassifyInput[] = [];
    for (let i = 0; i < 1000; i++) {
      let ex = '';
      while (ex.length < 1800) ex += words[next() % words.length] + ' ';
      jobs.push({ title: `Role ${i} ${words[next() % words.length]}`, company: `Invented Co ${i % 37}`, applyHost: 'jobs.lever.co/x', excerpt: ex });
    }
    classify(jobs[0] as ClassifyInput); // warm up
    const t0 = performance.now();
    for (const j of jobs) classify(j);
    const mean = (performance.now() - t0) / jobs.length;
    expect(mean).toBeLessThan(20);
    expect(featurize(jobs[0] as ClassifyInput).size).toBeGreaterThan(0);
  });
});
