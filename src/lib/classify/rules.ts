import { ATS_HOSTS } from './seed-agencies';
import type { AgencyRules, ClassifyInput } from './types';

export interface RuleOutcome {
  /** Probability of agency from rules, or null when no rule fired. */
  score: number | null;
  hits: string[];
  /** True when a hard hit (known agency domain/name, SIC) short circuits the model. */
  decisive: boolean;
}

export const DECISIVE_DOMAIN_SCORE = 0.98;
export const DECISIVE_NAME_SCORE = 0.96;
export const DECISIVE_SIC_SCORE = 0.92;
/** Soft: score = 0.5 + 0.1 * phrases (cap 0.8): one weak phrase stays in the pending band. */
export const PHRASE_BASE = 0.5;
export const PHRASE_STEP = 0.1;
export const PHRASE_CAP = 0.8;
/** Direct signal pulls the score down by this much (from 0.5 when nothing else fired). */
export const DIRECT_PENALTY = 0.35;

const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu', 'ltd', 'plc']);

/** Extract host and first path segment from a host or URL string. */
export function parseApply(raw: string | undefined): { host: string; slug: string } | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const slash = s.indexOf('/');
  const hostPart = slash === -1 ? s : s.slice(0, slash);
  const rest = slash === -1 ? '' : s.slice(slash + 1);
  const host = hostPart.replace(/^[^@]*@/, '').replace(/:\d+$/, '').replace(/^www\./, '');
  if (!host) return null;
  const slug = rest.split(/[/?#]/)[0] ?? '';
  return { host, slug };
}

/** Registrable domain (handles common co.uk style second level suffixes). */
export function registrableDomain(host: string | undefined): string {
  if (!host) return '';
  const parsed = parseApply(host);
  const h = parsed?.host ?? '';
  const labels = h.split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const last = labels[labels.length - 1] ?? '';
  const second = labels[labels.length - 2] ?? '';
  const take = last.length === 2 && SECOND_LEVEL.has(second) ? 3 : 2;
  return labels.slice(-take).join('.');
}

const GENERIC_NAME_WORDS = new Set([
  'inc', 'llc', 'ltd', 'limited', 'plc', 'corp', 'corporation', 'co', 'company', 'group',
  'staffing', 'recruitment', 'recruiting', 'services', 'solutions', 'international', 'global',
  'uk', 'usa', 'us', 'the', 'and', 'holdings', 'professional',
]);

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function containsSequence(hay: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > hay.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** Fragment match; single token fragments (e.g. "reed") only match with generic suffix words. */
export function nameMatchesFragment(company: string, fragment: string): boolean {
  const hay = nameTokens(company);
  const needle = nameTokens(fragment);
  if (!containsSequence(hay, needle)) return false;
  if (needle.length > 1) return true;
  return hay.every((t) => t === needle[0] || GENERIC_NAME_WORDS.has(t));
}

function compactName(name: string): string {
  return nameTokens(name)
    .filter((t) => !GENERIC_NAME_WORDS.has(t))
    .join('');
}

/** ATS slug matches company name (exact, or one contains the other when >= 4 chars). */
export function slugMatchesCompany(slug: string, company: string): boolean {
  const a = slug.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const b = compactName(company);
  if (!a || !b) return false;
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  return min >= 4 && (a.includes(b) || b.includes(a));
}

function atsSlug(apply: { host: string; slug: string }): string | null {
  for (const ats of ATS_HOSTS) {
    if (apply.host === ats.host || apply.host.endsWith('.' + ats.host)) {
      if (ats.style === 'path') return apply.slug || null;
      const sub = apply.host.slice(0, apply.host.length - ats.host.length - 1);
      const first = sub.split('.')[0];
      return first || null;
    }
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Compiled {
  domains: Set<string>;
  names: string[];
  phrases: Array<{ phrase: string; re: RegExp }>;
  sic: Set<string>;
}

// Rules are treated as immutable once passed in; build a fresh object after edits.
const cache = new WeakMap<AgencyRules, Compiled>();

function compile(rules: AgencyRules): Compiled {
  let c = cache.get(rules);
  if (!c) {
    c = {
      domains: new Set(rules.domains.map((d) => registrableDomain(d)).filter(Boolean)),
      names: rules.names.filter((n) => n.trim().length > 0),
      phrases: rules.phrases
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean)
        .map((phrase) => ({
          phrase,
          re: new RegExp('(?:^|[^\\p{L}\\p{N}])' + escapeRegExp(phrase).replace(/\s+/g, '\\s+') + '(?![\\p{L}\\p{N}])', 'u'),
        })),
      sic: new Set(rules.sicCodes.map((s) => s.trim())),
    };
    cache.set(rules, c);
  }
  return c;
}

export function applyRules(input: ClassifyInput, rules: AgencyRules): RuleOutcome {
  const c = compile(rules);
  const apply = parseApply(input.applyHost);
  const applyReg = apply ? registrableDomain(apply.host) : '';
  const companyReg = registrableDomain(input.companyDomain);

  // Decisive hard hits, strongest first.
  const hard: Array<{ score: number; hit: string }> = [];
  if (applyReg && c.domains.has(applyReg)) hard.push({ score: DECISIVE_DOMAIN_SCORE, hit: `agency apply domain: ${applyReg}` });
  if (companyReg && c.domains.has(companyReg)) hard.push({ score: DECISIVE_DOMAIN_SCORE, hit: `agency company domain: ${companyReg}` });
  const nameHit = c.names.find((n) => nameMatchesFragment(input.company, n));
  if (nameHit) hard.push({ score: DECISIVE_NAME_SCORE, hit: `agency name: ${nameHit}` });
  const sic = input.sicCode?.trim();
  if (sic && c.sic.has(sic)) hard.push({ score: DECISIVE_SIC_SCORE, hit: `agency SIC code: ${sic}` });
  if (hard.length > 0) {
    const score = Math.max(...hard.map((h) => h.score));
    return { score, hits: hard.map((h) => h.hit), decisive: true };
  }

  const hits: string[] = [];
  let score: number | null = null;

  const text = `${input.title}\n${input.excerpt}`.toLowerCase();
  const phraseHits = c.phrases.filter((p) => p.re.test(text));
  if (phraseHits.length > 0) {
    score = Math.min(PHRASE_CAP, PHRASE_BASE + PHRASE_STEP * phraseHits.length);
    for (const p of phraseHits) hits.push(`phrase: ${p.phrase}`);
  }

  // Direct employer signals lower the score.
  let direct = false;
  if (applyReg && companyReg && applyReg === companyReg) {
    direct = true;
    hits.push(`direct: apply host matches company domain (${companyReg})`);
  }
  if (apply) {
    const slug = atsSlug(apply);
    if (slug && slugMatchesCompany(slug, input.company)) {
      direct = true;
      hits.push(`direct: ATS board ${apply.host} slug "${slug}" matches company`);
    }
  }
  if (direct) score = (score ?? 0.5) - DIRECT_PENALTY;

  if (score !== null) score = Math.min(0.98, Math.max(0.02, score));
  return { score, hits, decisive: false };
}
