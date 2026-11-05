import { createHash } from 'node:crypto';

const EMPTY = 0xffffffff;

/** Lowercase word k-shingles (set of space joined strings). Text shorter than k words gives one shingle. */
export function shingles(text: string, k = 5): Set<string> {
  const words = text.toLowerCase().split(/[^\p{L}\p{N}+#]+/u).filter(Boolean);
  const out = new Set<string>();
  if (words.length === 0) return out;
  if (words.length < k) {
    out.add(words.join(' '));
    return out;
  }
  for (let i = 0; i + k <= words.length; i++) out.add(words.slice(i, i + k).join(' '));
  return out;
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function fmix(x: number): number {
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

const seedCache = new Map<number, { a: Uint32Array; b: Uint32Array }>();

/** Fixed seeds from a splitmix32 stream, so hash functions are identical on every run and machine. */
function seedsFor(perms: number): { a: Uint32Array; b: Uint32Array } {
  const hit = seedCache.get(perms);
  if (hit) return hit;
  const a = new Uint32Array(perms);
  const b = new Uint32Array(perms);
  let state = 0x9e3779b9;
  const next = (): number => {
    state = (state + 0x9e3779b9) >>> 0;
    return fmix(state);
  };
  for (let i = 0; i < perms; i++) {
    a[i] = (next() | 1) >>> 0; // odd multiplier
    b[i] = next();
  }
  const v = { a, b };
  seedCache.set(perms, v);
  return v;
}

/** MinHash signature with `perms` deterministic hash functions. Empty text gives all 0xffffffff. */
export function minhash(text: string, perms = 128): Uint32Array {
  const sig = new Uint32Array(perms).fill(EMPTY);
  const { a, b } = seedsFor(perms);
  for (const sh of shingles(text)) {
    const h = fnv1a(sh);
    for (let i = 0; i < perms; i++) {
      const v = fmix(((Math.imul(h, a[i] as number) + (b[i] as number)) >>> 0));
      if (v < (sig[i] as number)) sig[i] = v;
    }
  }
  return sig;
}

/** Estimated Jaccard similarity of two signatures of equal length. Empty signatures give 0. */
export function jaccardEstimate(a: Uint32Array, b: Uint32Array): number {
  if (a.length !== b.length) throw new Error('signature length mismatch');
  if (a.length === 0) return 0;
  let same = 0;
  let empty = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === EMPTY && b[i] === EMPTY) empty++;
    else if (a[i] === b[i]) same++;
  }
  if (empty === a.length) return 0;
  return same / a.length;
}

/** Stable sha1 hex of (company, normalised title, normalised location). */
export function dedupeKey(p: { companyId: string | number; titleNorm: string; locationNorm: string }): string {
  return createHash('sha1').update(`${p.companyId}\u0000${p.titleNorm}\u0000${p.locationNorm}`).digest('hex');
}

export function isNearDuplicate(a: Uint32Array, b: Uint32Array, threshold = 0.85): boolean {
  return jaccardEstimate(a, b) >= threshold;
}
