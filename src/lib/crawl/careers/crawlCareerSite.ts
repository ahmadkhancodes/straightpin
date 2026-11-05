import type { FetchResult, Fetcher, NormalizedJob } from '../types';
import { extractJobPostings, jobPostingToNormalized } from './jsonld';
import { chooseSitemaps, filterJobUrls, parseSitemap } from './sitemap';

export interface CrawlCareerSiteOptions {
  host: string;
  robotsSitemaps: string[];
  fetcher: Fetcher;
  maxUrls?: number;
  now?: Date;
}
export interface CrawlCareerSiteResult { jobs: NormalizedJob[]; closedUrls: string[]; blocked: boolean }

const MAX_SITEMAP_DEPTH = 2;
const MAX_SITEMAP_FETCHES = 25;

/** The bot challenge shape: a block status with a challenge body. We stop, we never retry or evade. */
export function isBotChallenge(res: FetchResult): boolean {
  if (![403, 429, 503].includes(res.status)) return false;
  return /just a moment|cf-chl|captcha/i.test(res.body);
}

function hostOfUrl(u: string): string {
  try { return new URL(u).hostname.toLowerCase(); } catch { return ''; }
}

export async function crawlCareerSite(opts: CrawlCareerSiteOptions): Promise<CrawlCareerSiteResult> {
  const { host, robotsSitemaps, fetcher } = opts;
  const maxUrls = opts.maxUrls ?? 500;
  const now = opts.now ?? new Date();
  const jobs: NormalizedJob[] = [];
  const closed = new Set<string>();
  const result = (blocked: boolean): CrawlCareerSiteResult => ({ jobs, closedUrls: [...closed], blocked });

  const bareHost = host.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const roots = chooseSitemaps(robotsSitemaps);
  if (roots.length === 0) roots.push(`https://${bareHost}/sitemap.xml`);
  const allowedHosts = new Set<string>([bareHost, ...roots.map(hostOfUrl)]);

  // Phase 1: sitemaps, breadth first, index depth <= 2.
  const jobUrls: string[] = [];
  const seenUrls = new Set<string>();
  const seenMaps = new Set<string>(roots);
  const queue: Array<{ url: string; depth: number }> = roots.map((url) => ({ url, depth: 0 }));
  let mapFetches = 0;
  while (queue.length > 0 && mapFetches < MAX_SITEMAP_FETCHES && jobUrls.length < maxUrls) {
    const item = queue.shift();
    if (!item) break;
    mapFetches++;
    const res = await fetcher.fetch({ url: item.url });
    if (isBotChallenge(res)) return result(true);
    if (res.status !== 200 || res.notModified) continue;
    const parsed = parseSitemap(res.body);
    if (parsed.kind === 'sitemapindex') {
      if (item.depth >= MAX_SITEMAP_DEPTH) continue;
      for (const child of chooseSitemaps(parsed.urls, MAX_SITEMAP_FETCHES)) {
        if (seenMaps.has(child) || !allowedHosts.has(hostOfUrl(child))) continue;
        seenMaps.add(child);
        queue.push({ url: child, depth: item.depth + 1 });
      }
    } else if (parsed.kind === 'urlset') {
      for (const u of filterJobUrls(parsed.urls)) {
        if (seenUrls.has(u) || !allowedHosts.has(hostOfUrl(u))) continue;
        seenUrls.add(u);
        jobUrls.push(u);
      }
    }
  }

  // Phase 2: job pages, capped at maxUrls fetches.
  const seenIds = new Set<string>();
  for (const url of jobUrls.slice(0, maxUrls)) {
    const res = await fetcher.fetch({ url });
    if (isBotChallenge(res)) return result(true);
    if (res.status === 404 || res.status === 410) { closed.add(url); continue; }
    if (res.status !== 200 || res.notModified) continue;
    const postings = extractJobPostings(res.body);
    postings.forEach((raw, i) => {
      const job = jobPostingToNormalized(raw, url);
      if (!job) return;
      if (postings.length > 1 && job.externalId === job.applyUrl && job.applyUrl === url) job.externalId = `${url}#${i}`;
      if (job.validThrough && job.validThrough.getTime() < now.getTime()) { closed.add(url); return; }
      if (seenIds.has(job.externalId)) return;
      seenIds.add(job.externalId);
      jobs.push(job);
    });
  }
  return result(false);
}
