import { describe, expect, it } from 'vitest';
import { loadModel } from '../../src/lib/classify/model';
import type { ClassifyInput } from '../../src/lib/classify/types';
import { evaluate, exportModel, passesGate, trainLogReg } from './train';
import type { Sample } from './train';

// SYNTHETIC data only: invented company names and templated text, not real postings.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0);
}

function makeSynthetic(n: number, seed: number): Sample[] {
  const next = lcg(seed);
  const pick = <T,>(a: T[]): T => a[next() % a.length] as T;
  const agencyNames = ['Zorblax Talent Partners', 'Quillfeather Recruiting', 'Brumble Placement Group', 'Vexnor Workforce'];
  const directNames = ['Moonbeam Pottery Works', 'Tangleroot Software', 'Pelican Hollow Bakery', 'Nimbus Gearworks'];
  const agencyText = ['our client is a leading firm seeking', 'on behalf of our client we are recruiting', 'staffing contract to hire', 'apply to our recruitment agency today', 'talent acquisition partner for a confidential client'];
  const directText = ['join our team and build products you love', 'we are a family company with great benefits', 'you will work with our engineers and designers', 'we offer equity and a friendly culture', 'our mission is to craft delightful experiences'];
  const roles = ['Support Specialist', 'Office Coordinator', 'Data Entry Clerk', 'Account Manager'];
  const out: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const agency = i % 2 === 0;
    const input: ClassifyInput = {
      title: pick(roles),
      company: pick(agency ? agencyNames : directNames),
      excerpt: `${pick(agency ? agencyText : directText)}. ${pick(agency ? agencyText : directText)}. Duties include answering email.`,
    };
    out.push({ input, label: agency ? 'agency' : 'direct' });
  }
  return out;
}

describe('passesGate', () => {
  it('requires n >= 300, precision >= 0.95, recall >= 0.85', () => {
    expect(passesGate({ precision: 1, recall: 1, f1: 1, n: 299 })).toBe(false);
    expect(passesGate({ precision: 0.95, recall: 0.85, f1: 0.9, n: 300 })).toBe(true);
    expect(passesGate({ precision: 0.949, recall: 0.99, f1: 0.97, n: 500 })).toBe(false);
    expect(passesGate({ precision: 0.99, recall: 0.849, f1: 0.9, n: 500 })).toBe(false);
  });
});

describe('train / evaluate', () => {
  const train = makeSynthetic(400, 1);
  const heldOut = makeSynthetic(400, 99);
  const model = trainLogReg(train, { seed: 7 });

  it('is deterministic for a fixed seed', () => {
    expect(exportModel(trainLogReg(train, { seed: 7 }))).toBe(exportModel(model));
  });
  it('gate passes on a separable synthetic set of 400', () => {
    const m = evaluate(model, heldOut);
    expect(m.n).toBe(400);
    expect(m.precision).toBeGreaterThanOrEqual(0.95);
    expect(m.recall).toBeGreaterThanOrEqual(0.85);
    expect(passesGate(m)).toBe(true);
  });
  it('gate fails when held out set has n < 300', () => {
    const m = evaluate(model, heldOut.slice(0, 200));
    expect(m.n).toBe(200);
    expect(passesGate(m)).toBe(false);
  });
  it('evaluate math on a stub model', () => {
    const samples: Sample[] = [
      { input: { title: 'a', company: 'x', excerpt: 'tp' }, label: 'agency' },
      { input: { title: 'a', company: 'x', excerpt: 'fp' }, label: 'direct' },
      { input: { title: 'a', company: 'x', excerpt: 'fn' }, label: 'agency' },
      { input: { title: 'a', company: 'x', excerpt: 'tn' }, label: 'direct' },
    ];
    const stub = { predict: () => 0 };
    expect(evaluate(stub, samples)).toEqual({ precision: 0, recall: 0, f1: 0, n: 4 });
    expect(evaluate({ predict: () => 1 }, samples)).toEqual({ precision: 0.5, recall: 1, f1: 2 / 3, n: 4 });
  });
  it('exported JSON reloads and predicts the same', () => {
    const reloaded = loadModel(exportModel(model));
    expect(evaluate(reloaded, heldOut)).toEqual(evaluate(model, heldOut));
  });
  it('throws on empty training set', () => {
    expect(() => trainLogReg([])).toThrow();
  });
});
