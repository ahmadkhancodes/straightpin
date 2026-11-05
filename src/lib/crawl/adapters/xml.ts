/** Tiny, safe XML helpers for flat feeds (Recruitee, Personio). No entity expansion, no DTDs. */

export class UnsafeXmlError extends Error {
  constructor() { super('refusing XML containing DOCTYPE or ENTITY declarations'); this.name = 'UnsafeXmlError'; }
}

export function assertSafeXml(xml: string): void {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new UnsafeXmlError();
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => safeCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => safeCode(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function safeCode(n: number): string {
  try { return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; } catch { return ''; }
}

/** Inner XML of every `<tag>` element (non nested use only). */
export function getAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  const out: string[] = [];
  for (const m of xml.matchAll(re)) out.push(m[1] ?? '');
  return out;
}

/** Text of the first `<tag>`; CDATA unwrapped, entities decoded once. */
export function getText(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (!m) return null;
  const inner = (m[1] ?? '').trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(inner);
  const text = cdata ? (cdata[1] ?? '') : decode(inner);
  return text.trim() || null;
}
