export type SitemapKind = 'urlset' | 'sitemapindex' | 'refused' | 'unknown';
export interface ParsedSitemap { kind: SitemapKind; urls: string[] }

function decodeXml(s: string): string {
  return s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

/** Parse a urlset or sitemapindex. XML with a DOCTYPE or ENTITY declaration is refused (XXE and entity bombs). */
export function parseSitemap(xml: string): ParsedSitemap {
  if (typeof xml !== 'string') return { kind: 'unknown', urls: [] };
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) return { kind: 'refused', urls: [] };
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const isSet = /<urlset[\s>]/i.test(xml);
  if (!isIndex && !isSet) return { kind: 'unknown', urls: [] };
  const urls: string[] = [];
  const seen = new Set<string>();
  const block = isIndex ? /<sitemap\b[^>]*>([\s\S]*?)<\/sitemap>/gi : /<url\b[^>]*>([\s\S]*?)<\/url>/gi;
  for (const m of xml.matchAll(block)) {
    const loc = /<loc\b[^>]*>([\s\S]*?)<\/loc>/i.exec(m[1] ?? '');
    if (!loc) continue;
    const u = decodeXml(loc[1] ?? '');
    if (!/^https?:\/\//i.test(u) || seen.has(u)) continue;
    seen.add(u);
    urls.push(u);
  }
  return { kind: isIndex ? 'sitemapindex' : 'urlset', urls };
}

const JOB_SEGMENT = /\/(jobs?|careers?|positions?|opportunit[a-z]*|vacanc[a-z]*|requisitions?|openings?)\/([^/?#]+)/i;
const LISTING_WORDS = new Set([
  'search', 'results', 'category', 'categories', 'location', 'locations', 'department', 'departments', 'team', 'teams',
  'page', 'all', 'list', 'filter', 'filters', 'tag', 'tags', 'index', 'alerts', 'saved', 'login', 'sign-in', 'signin',
  'benefits', 'culture', 'students', 'university', 'internships', 'life', 'faq', 'apply', 'talent-community',
]);

function isJobDetailUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  const path = u.pathname;
  const lower = path.toLowerCase();
  if (/\/(search|results|category|categories)(\/|$)/.test(lower)) return false;
  for (const key of u.searchParams.keys()) {
    if (/^(q|query|keyword|keywords|search|page|p|location|department)$/i.test(key)) return false;
  }
  // Workday style detail: .../job/<location>/<title>_<reqId>
  if (/myworkdayjobs\.com$/i.test(u.hostname) || /myworkdaysite\.com$/i.test(u.hostname)) {
    return /\/job\/[^/]+\/[^/]+/i.test(path) || /\/details\/[^/]+/i.test(path);
  }
  const m = JOB_SEGMENT.exec(path);
  if (!m) return false;
  const seg = (m[2] ?? '').toLowerCase();
  if (LISTING_WORDS.has(seg)) return false;
  if (/^\d{1,2}$/.test(seg) && /\/(jobs?|careers?)\/\d{1,2}\/?$/i.test(path)) return false; // pagination
  return true;
}

/** Keep likely job detail URLs, drop listing, search and category pages. Order kept, duplicates removed. */
export function filterJobUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (seen.has(url) || !isJobDetailUrl(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** Pick sitemaps to fetch from robots.txt: http(s) only, no repeats, job-looking ones first, capped. */
export function chooseSitemaps(robotsSitemaps: string[], max = 5): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const s of robotsSitemaps) {
    const t = s.trim();
    if (!/^https?:\/\//i.test(t) || /\.gz(\?|$)/i.test(t) || seen.has(t)) continue;
    seen.add(t);
    valid.push(t);
  }
  const jobish = (s: string): boolean => /job|career|position|vacanc|opportunit|opening/i.test(s);
  return [...valid.filter(jobish), ...valid.filter((s) => !jobish(s))].slice(0, max);
}
