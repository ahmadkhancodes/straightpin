import type { Country, PayPeriod, RemoteType } from './types';

export const EXCERPT_MAX = 600;

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

export function excerptOf(text: string, max = EXCERPT_MAX): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}

/** Lowercase, strip seniority noise in brackets, punctuation to spaces, collapse. */
export function normTitle(title: string): string {
  return title.toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[^a-z0-9+#]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normLocation(loc: string | null | undefined): string {
  return (loc ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const US_STATES = 'al ak az ar ca co ct fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc'.split(' ');
const CA_PROV = 'on bc ab qc mb sk ns nb nl pe yt nt nu'.split(' ');

/** Best effort country from a free text location. Returns null when not clearly US/CA/UK. */
export function detectCountry(location: string | null | undefined, hint?: string | null): Country | null {
  const raw = `${location ?? ''} ${hint ?? ''}`.trim();
  const s = ' ' + raw.toLowerCase().replace(/[.,;()/|-]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  if (!raw) return null;
  if (/ (united kingdom|uk|gb|great britain|england|scotland|wales|northern ireland|london|manchester|birmingham|leeds|glasgow) /.test(s)) return 'UK';
  if (/ (canada|toronto|vancouver|montreal|ottawa|calgary|ontario|british columbia|alberta|quebec) /.test(s)) {
    if (!/ (united states|usa|us) /.test(s)) return 'CA';
  }
  if (/ (united states|united states of america|usa|us|u s) /.test(s)) return 'US';
  const tokens = s.trim().split(' ');
  if (tokens.some((t) => CA_PROV.includes(t)) && /(toronto|vancouver|ontario|canada|ottawa|calgary|montreal)/.test(s)) return 'CA';
  const last = tokens[tokens.length - 1];
  if (last && US_STATES.includes(last) && tokens.length >= 2) return 'US';
  if (/ (new york|san francisco|seattle|austin|chicago|boston|denver|atlanta|los angeles|remote us) /.test(s)) return 'US';
  return null;
}

export function detectRemoteType(...parts: Array<string | null | undefined>): RemoteType {
  const s = parts.filter(Boolean).join(' ').toLowerCase();
  if (/\bhybrid\b/.test(s)) return 'hybrid';
  if (/\b(remote|work from home|wfh|telecommut|distributed)\b/.test(s)) return 'remote';
  if (/\b(on-?site|in[- ]office|in[- ]person)\b/.test(s)) return 'onsite';
  return 'unknown';
}

export function hostOf(url: string): string {
  try { return new URL(url).host.toLowerCase(); } catch { return ''; }
}

/** Convert an annual or hourly amount to the period label; pass through otherwise. */
export function payPeriodFrom(s: string | null | undefined): PayPeriod | null {
  const t = (s ?? '').toLowerCase();
  if (/hour|hr/.test(t)) return 'hour';
  if (/year|annual|yr/.test(t)) return 'year';
  if (/month/.test(t)) return 'month';
  if (/week/.test(t)) return 'week';
  if (/day|daily/.test(t)) return 'day';
  return null;
}
