/** Minimal robots.txt parser + policy mapping. Pure TS, no dependencies. */

export const ROBOTS_PRODUCT_TOKEN = 'straightpinbybuffersolbot';
export const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;
const ERROR_TTL_MS = 60 * 60 * 1000;
const DEFAULT_DELAY_MS = 1000;

export interface RobotsRule { allow: boolean; pattern: string }
export interface RobotsRules { rules: RobotsRule[]; crawlDelaySec: number | null; sitemaps: string[] }

export class RobotsDisallowedError extends Error {
  constructor(public readonly url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = 'RobotsDisallowedError';
  }
}

interface Group { agents: string[]; rules: RobotsRule[]; crawlDelay: number | null }

export function parseRobots(body: string): RobotsRules {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const rawLine of body.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'sitemap') { if (value) sitemaps.push(value); continue; }
    if (field === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [], crawlDelay: null }; groups.push(cur); }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (field === 'allow' || field === 'disallow') {
      if (value) cur.rules.push({ allow: field === 'allow', pattern: value });
    } else if (field === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) cur.crawlDelay = n;
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && a !== '' && ROBOTS_PRODUCT_TOKEN.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  const delays = chosen.map((g) => g.crawlDelay).filter((d): d is number => d !== null);
  return {
    rules: chosen.flatMap((g) => g.rules),
    crawlDelaySec: delays.length ? Math.max(...delays) : null,
    sitemaps,
  };
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const core = anchored ? pattern.slice(0, -1) : pattern;
  const src = core.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + src + (anchored ? '$' : ''));
}

/** Longest matching pattern wins; Allow wins a tie; no match means allowed. `path` includes the query string. */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  let best: RobotsRule | null = null;
  for (const r of rules.rules) {
    if (!patternToRegex(r.pattern).test(path)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow && !best.allow)) best = r;
  }
  return best ? best.allow : true;
}

/** Cacheable record of what we know about a host's robots.txt. */
export interface RobotsRecord {
  fetchedAt: number;
  ttlMs: number;
  status: number | null; // null = network error
  mode: 'rules' | 'allow_slow' | 'disallow_all';
  rules: RobotsRules | null;
}

export interface RobotsDecision { allowed: boolean; crawlDelayMs: number }

export const RobotsPolicy = {
  /** Map an HTTP result for /robots.txt to a record (brief: 404/410 allowed at 1 req/s; 5xx disallow 24h; 401/403 disallow; error disallow). */
  fromResponse(status: number, body: string, now: number): RobotsRecord {
    if (status >= 200 && status < 300) return { fetchedAt: now, ttlMs: ROBOTS_TTL_MS, status, mode: 'rules', rules: parseRobots(body) };
    if (status === 401 || status === 403 || status >= 500) return { fetchedAt: now, ttlMs: ROBOTS_TTL_MS, status, mode: 'disallow_all', rules: null };
    // 404, 410 and other 4xx: no robots file, allowed at the default rate.
    return { fetchedAt: now, ttlMs: ROBOTS_TTL_MS, status, mode: 'allow_slow', rules: null };
  },
  /** Network failure while fetching robots.txt: disallow, retry sooner than 24h. */
  fromError(now: number): RobotsRecord {
    return { fetchedAt: now, ttlMs: ERROR_TTL_MS, status: null, mode: 'disallow_all', rules: null };
  },
  expiresAt(rec: RobotsRecord): number { return rec.fetchedAt + rec.ttlMs; },
  isFresh(rec: RobotsRecord, now: number): boolean { return now < rec.fetchedAt + rec.ttlMs; },
  evaluate(rec: RobotsRecord, path: string): RobotsDecision {
    if (rec.mode === 'disallow_all') return { allowed: false, crawlDelayMs: DEFAULT_DELAY_MS };
    if (rec.mode === 'allow_slow' || !rec.rules) return { allowed: true, crawlDelayMs: DEFAULT_DELAY_MS };
    const delay = rec.rules.crawlDelaySec === null ? DEFAULT_DELAY_MS : Math.max(DEFAULT_DELAY_MS, rec.rules.crawlDelaySec * 1000);
    return { allowed: isAllowed(rec.rules, path), crawlDelayMs: delay };
  },
};

export interface RobotsStore {
  get(host: string): Promise<RobotsRecord | null>;
  put(host: string, rec: RobotsRecord): Promise<void>;
}

export class InMemoryRobotsStore implements RobotsStore {
  private map = new Map<string, RobotsRecord>();
  async get(host: string): Promise<RobotsRecord | null> { return this.map.get(host.toLowerCase()) ?? null; }
  async put(host: string, rec: RobotsRecord): Promise<void> { this.map.set(host.toLowerCase(), rec); }
}
