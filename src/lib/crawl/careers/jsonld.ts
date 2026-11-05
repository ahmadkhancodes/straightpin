import type { Country, NormalizedJob, PayPeriod } from '../types';
import { detectCountry, detectRemoteType, excerptOf, hostOf, htmlToText, normTitle, payPeriodFrom } from '../normalize';

/** A schema.org JobPosting as found in the page. Shape is untrusted, so values are unknown. */
export type RawJobPosting = Record<string, unknown>;

const LD_SCRIPT = /<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
const MAX_DEPTH = 8;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasJobPostingType(o: Record<string, unknown>): boolean {
  const t = o['@type'];
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === 'string' && /(^|[/#:])JobPosting$/i.test(x.trim()));
}

function walk(node: unknown, out: RawJobPosting[], depth: number): void {
  if (depth > MAX_DEPTH) return;
  if (Array.isArray(node)) {
    for (const n of node) walk(n, out, depth + 1);
    return;
  }
  if (!isObj(node)) return;
  if (hasJobPostingType(node)) {
    out.push(node);
    return;
  }
  for (const v of Object.values(node)) {
    if (typeof v === 'object' && v !== null) walk(v, out, depth + 1);
  }
}

function parseJsonSafe(raw: string): unknown {
  let s = raw.trim();
  s = s.replace(/^<!--/, '').replace(/-->$/, '').replace(/^\/\/<!\[CDATA\[|\/\/\]\]>$/g, '').trim();
  s = s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/** Every JobPosting object in every ld+json script. Malformed scripts are skipped, never thrown. */
export function extractJobPostings(html: string): RawJobPosting[] {
  const out: RawJobPosting[] = [];
  if (typeof html !== 'string' || !html) return out;
  for (const m of html.matchAll(LD_SCRIPT)) {
    const parsed = parseJsonSafe(m[1] ?? '');
    if (parsed !== undefined) walk(parsed, out, 0);
  }
  return out;
}

function str(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

/** Name of a Place/Country/State that may be a plain string or {name}. */
function nameOf(v: unknown): string | null {
  if (isObj(v)) return str(v['name']);
  return str(v);
}

function asList(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface Loc { locality: string | null; region: string | null; country: string | null }

function placeToLoc(place: unknown): Loc | null {
  if (typeof place === 'string') return { locality: place.trim() || null, region: null, country: null };
  if (!isObj(place)) return null;
  const addr = place['address'];
  if (typeof addr === 'string') return { locality: addr.trim() || null, region: null, country: null };
  if (isObj(addr)) {
    return {
      locality: str(addr['addressLocality']),
      region: str(addr['addressRegion']),
      country: nameOf(addr['addressCountry']),
    };
  }
  const n = str(place['name']);
  return n ? { locality: n, region: null, country: null } : null;
}

const COUNTRY_NAMES: Record<string, Country> = {
  us: 'US', usa: 'US', 'united states': 'US', 'united states of america': 'US',
  ca: 'CA', can: 'CA', canada: 'CA',
  uk: 'UK', gb: 'UK', gbr: 'UK', 'united kingdom': 'UK', 'great britain': 'UK', england: 'UK', scotland: 'UK', wales: 'UK', 'northern ireland': 'UK',
};

function countryFromName(name: string): Country | null {
  return COUNTRY_NAMES[name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()] ?? null;
}

const CURRENCIES = ['USD', 'CAD', 'GBP', 'EUR'] as const;

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[,\s]/g, ''));
    if (v.trim() && Number.isFinite(n)) return n;
  }
  return null;
}

interface Pay {
  payMin: number | null; payMax: number | null; payPeriod: PayPeriod | null; currency: NormalizedJob['currency'];
}

function parsePay(base: unknown): Pay {
  const none: Pay = { payMin: null, payMax: null, payPeriod: null, currency: null };
  const b = asList(base).find(isObj);
  if (!b) return none;
  const cur = str(b['currency'])?.toUpperCase() ?? null;
  const currency = (CURRENCIES as readonly string[]).includes(cur ?? '') ? (cur as NormalizedJob['currency']) : null;
  const v = b['value'];
  let min: number | null; let max: number | null; let unit: string | null;
  if (isObj(v)) {
    const single = num(v['value']);
    min = num(v['minValue']) ?? single;
    max = num(v['maxValue']) ?? single;
    unit = str(v['unitText']) ?? str(b['unitText']);
  } else {
    const single = num(v);
    min = num(b['minValue']) ?? single;
    max = num(b['maxValue']) ?? single;
    unit = str(b['unitText']);
  }
  if (min === null && max === null) return none;
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return { payMin: min ?? max, payMax: max ?? min, payPeriod: payPeriodFrom(unit), currency };
}

function identifierOf(raw: RawJobPosting): string | null {
  const id = raw['identifier'];
  if (isObj(id)) return str(id['value']) ?? str(id['name']);
  return str(id);
}

function absUrl(candidate: string | null, pageUrl: string): string | null {
  if (!candidate) return null;
  try {
    const u = new URL(candidate, pageUrl);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function descriptionText(d: unknown): string {
  const s = typeof d === 'string' ? d : '';
  let t = htmlToText(s);
  if (/<\/?[a-z][^>]*>/i.test(t)) t = htmlToText(t); // description was entity escaped HTML
  return t;
}

/** Map a JobPosting to our job shape. Returns null when it is not clearly US/CA/UK or has no title. */
export function jobPostingToNormalized(raw: RawJobPosting, pageUrl: string): NormalizedJob | null {
  const title = str(raw['title']) ?? str(raw['name']);
  if (!title) return null;

  const locs = asList(raw['jobLocation']).map(placeToLoc).filter((l): l is Loc => l !== null);
  const first = locs[0] ?? null;
  const telecommute = asList(raw['jobLocationType']).some((t) => typeof t === 'string' && /telecommute/i.test(t));

  const applicant = asList(raw['applicantLocationRequirements']).map(nameOf).filter((x): x is string => x !== null);

  const locParts = first ? [first.locality, first.region, first.country].filter((x): x is string => !!x) : [];
  let location: string | null = locParts.length ? locParts.join(', ') : null;
  if (!location && telecommute && applicant.length) location = applicant[0] ?? null;

  // A structured country wins over free text guessing ("Berlin, DE" would otherwise read as Delaware).
  const structured = first?.country ?? (telecommute && !first ? applicant[0] ?? null : null);
  const country: Country | null = structured
    ? countryFromName(structured)
    : detectCountry(location, applicant.join(' '));
  if (!country) return null;

  const remoteType = telecommute ? 'remote' : detectRemoteType(title, location);
  const pay = parsePay(raw['baseSalary']);

  const applyUrl = absUrl(str(raw['url']), pageUrl) ?? absUrl(pageUrl, pageUrl);
  if (!applyUrl) return null;

  return {
    ats: 'jsonld',
    externalId: identifierOf(raw) ?? applyUrl,
    title,
    titleNorm: normTitle(title),
    excerpt: excerptOf(descriptionText(raw['description'])),
    country,
    region: first?.region ?? null,
    location,
    remoteType,
    ...pay,
    applyUrl,
    sourceHost: hostOf(applyUrl),
    firstPublishedAt: parseDate(raw['datePosted']), // never dateModified
    validThrough: parseDate(raw['validThrough']),
  };
}
