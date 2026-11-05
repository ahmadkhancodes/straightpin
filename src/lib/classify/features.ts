import { registrableDomain } from './rules';
import type { ClassifyInput, FeatureVector } from './types';

export const DIM = 1 << 16;
const MAX_EXCERPT_CHARS = 1500;

/** 32 bit FNV-1a over UTF-16 code units (high byte mixed in for non-Latin1). */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h ^= c & 0xff;
    h = Math.imul(h, 0x01000193);
    if (c > 0xff) {
      h ^= c >>> 8;
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Feature strings (namespaced) for one input; exposed for training/idf. */
function forEachFeature(input: ClassifyInput, emit: (f: string) => void): void {
  const title = normalize(input.title);
  const company = normalize(input.company);
  const excerpt = normalize(input.excerpt.slice(0, MAX_EXCERPT_CHARS));

  const titleToks = title ? title.split(' ') : [];
  for (let i = 0; i < titleToks.length; i++) {
    emit('t1:' + titleToks[i]);
    if (i + 1 < titleToks.length) emit('t2:' + titleToks[i] + ' ' + titleToks[i + 1]);
  }
  const bodyToks = (company + ' ' + excerpt).trim();
  const toks = bodyToks ? bodyToks.split(' ') : [];
  for (let i = 0; i < toks.length; i++) {
    emit('w1:' + toks[i]);
    if (i + 1 < toks.length) emit('w2:' + toks[i] + ' ' + toks[i + 1]);
  }
  const chars = ` ${title} | ${company} | ${excerpt} `;
  if (title || company || excerpt) {
    for (let n = 3; n <= 5; n++) {
      for (let i = 0; i + n <= chars.length; i++) emit('c' + n + ':' + chars.slice(i, i + n));
    }
  }
  const host = registrableDomain(input.applyHost);
  if (host) emit('h:' + host);
  const sic = input.sicCode?.trim();
  if (sic) emit('s:' + sic);
}

/**
 * TF-IDF hashed features (signed hashing trick, sublinear tf), L2 normalised.
 * Pure and deterministic. `idf` (hashed index -> idf) is optional; missing means 1.
 */
export function featurize(input: ClassifyInput, idf?: ReadonlyMap<number, number>): FeatureVector {
  const counts = new Map<number, number>();
  forEachFeature(input, (f) => {
    const h = fnv1a(f);
    const idx = h & (DIM - 1);
    const sign = (h >>> 16) & 1 ? -1 : 1;
    counts.set(idx, (counts.get(idx) ?? 0) + sign);
  });
  const out: FeatureVector = new Map();
  let sumSq = 0;
  for (const [idx, c] of counts) {
    if (c === 0) continue;
    const mag = 1 + Math.log(Math.abs(c));
    const v = Math.sign(c) * mag * (idf?.get(idx) ?? 1);
    out.set(idx, v);
    sumSq += v * v;
  }
  const norm = Math.sqrt(sumSq);
  if (norm > 0) for (const [idx, v] of out) out.set(idx, v / norm);
  return out;
}
