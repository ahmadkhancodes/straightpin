import { describe, expect, it } from 'vitest';
import { dedupeKey, isNearDuplicate, jaccardEstimate, minhash, shingles } from './minhash';

const WORDS = 'build scalable backend services using typescript and postgres while collaborating with product designers and mentoring engineers across the platform team to improve reliability observability and developer experience for customers who depend on our payments pipeline every single day'.split(' ');
const longText = (n: number, salt = ''): string => Array.from({ length: n }, (_, i) => `${WORDS[(i * 7 + salt.length) % WORDS.length]}${i % 11 === 0 ? i : ''}`).join(' ');

describe('shingles', () => {
  it('makes k word shingles, case and punctuation insensitive', () => {
    const s = shingles('The quick, brown fox jumps over', 3);
    expect([...s]).toEqual(['the quick brown', 'quick brown fox', 'brown fox jumps', 'fox jumps over']);
  });
  it('short text gives one shingle, empty gives none', () => {
    expect(shingles('hello world').size).toBe(1);
    expect(shingles('   ').size).toBe(0);
  });
});

describe('minhash', () => {
  const base = longText(220);
  it('has 128 perms by default and is deterministic', () => {
    const a = minhash(base);
    const b = minhash(base);
    expect(a).toBeInstanceOf(Uint32Array);
    expect(a.length).toBe(128);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
  it('identical text gives 1.0', () => {
    expect(jaccardEstimate(minhash(base), minhash(base))).toBe(1);
  });
  it('near identical text is >= 0.85', () => {
    const words = base.split(' ');
    words[100] = 'CHANGED';
    const near = words.join(' ');
    const est = jaccardEstimate(minhash(base), minhash(near));
    expect(est).toBeGreaterThanOrEqual(0.85);
    expect(isNearDuplicate(minhash(base), minhash(near))).toBe(true);
  });
  it('different text is low', () => {
    const other = 'completely unrelated warehouse role lifting boxes operating forklifts maintaining safety records and loading trucks during night shifts with strict attendance rules and weekly inventory counts across the distribution center floor and docks'.repeat(1);
    const est = jaccardEstimate(minhash(base), minhash(other));
    expect(est).toBeLessThan(0.2);
    expect(isNearDuplicate(minhash(base), minhash(other))).toBe(false);
  });
  it('empty text never counts as a duplicate', () => {
    expect(jaccardEstimate(minhash(''), minhash(''))).toBe(0);
  });
  it('throws on length mismatch', () => {
    expect(() => jaccardEstimate(minhash('a b c d e f', 16), minhash('a b c d e f', 32))).toThrow();
  });
});

describe('dedupeKey', () => {
  it('is stable sha1 hex and sensitive to each field', () => {
    const k = dedupeKey({ companyId: 'c1', titleNorm: 'staff engineer', locationNorm: 'austin tx' });
    expect(k).toMatch(/^[0-9a-f]{40}$/);
    expect(k).toBe(dedupeKey({ companyId: 'c1', titleNorm: 'staff engineer', locationNorm: 'austin tx' }));
    expect(k).not.toBe(dedupeKey({ companyId: 'c2', titleNorm: 'staff engineer', locationNorm: 'austin tx' }));
    expect(k).not.toBe(dedupeKey({ companyId: 'c1', titleNorm: 'staff engineers', locationNorm: 'austin tx' }));
    expect(k).not.toBe(dedupeKey({ companyId: 'c1', titleNorm: 'staff engineer', locationNorm: 'remote' }));
    expect(dedupeKey({ companyId: 'ab', titleNorm: 'c', locationNorm: '' })).not.toBe(dedupeKey({ companyId: 'a', titleNorm: 'bc', locationNorm: '' }));
  });
});
