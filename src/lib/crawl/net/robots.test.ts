import { describe, expect, it } from 'vitest';
import { InMemoryRobotsStore, isAllowed, parseRobots, RobotsPolicy, ROBOTS_TTL_MS } from './robots';

describe('parseRobots', () => {
  it('prefers our own group over *', () => {
    const r = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: StraightpinByBufferSolBot\nDisallow: /private\n');
    expect(isAllowed(r, '/jobs')).toBe(true);
    expect(isAllowed(r, '/private/x')).toBe(false);
  });
  it('falls back to * and ignores other bots', () => {
    const r = parseRobots('User-agent: Googlebot\nAllow: /\n\nUser-agent: *\nDisallow: /admin\n');
    expect(isAllowed(r, '/admin')).toBe(false);
    expect(isAllowed(r, '/a')).toBe(true);
  });
  it('longest match wins', () => {
    const r = parseRobots('User-agent: *\nDisallow: /jobs\nAllow: /jobs/public\nDisallow: /jobs/public/secret\n');
    expect(isAllowed(r, '/jobs/x')).toBe(false);
    expect(isAllowed(r, '/jobs/public/a')).toBe(true);
    expect(isAllowed(r, '/jobs/public/secret/1')).toBe(false);
  });
  it('Allow beats Disallow on equal length', () => {
    const r = parseRobots('User-agent: *\nDisallow: /page\nAllow: /page\n');
    expect(isAllowed(r, '/page')).toBe(true);
  });
  it('supports wildcards, $, comments, empty Disallow', () => {
    const r = parseRobots('User-agent: *\nDisallow: /*.pdf$ # no pdfs\nDisallow:\nDisallow: /tmp*/x\n');
    expect(isAllowed(r, '/a/b.pdf')).toBe(false);
    expect(isAllowed(r, '/a/b.pdf?x=1')).toBe(true);
    expect(isAllowed(r, '/tmp123/x')).toBe(false);
  });
  it('parses Crawl-delay and Sitemap lines', () => {
    const r = parseRobots('Sitemap: https://x.test/s.xml\nUser-agent: *\nCrawl-delay: 5\nDisallow: /a\nSitemap: https://x.test/s2.xml');
    expect(r.crawlDelaySec).toBe(5);
    expect(r.sitemaps).toEqual(['https://x.test/s.xml', 'https://x.test/s2.xml']);
  });
  it('empty file allows everything', () => {
    expect(isAllowed(parseRobots(''), '/anything')).toBe(true);
  });
  it('handles stacked user-agent lines', () => {
    const r = parseRobots('User-agent: foo\nUser-agent: straightpinbybuffersolbot\nDisallow: /x\n');
    expect(isAllowed(r, '/x')).toBe(false);
  });
});

describe('RobotsPolicy', () => {
  const now = 1_000_000;
  it('404 and 410 allow at 1 req/s', () => {
    for (const s of [404, 410]) {
      const rec = RobotsPolicy.fromResponse(s, '', now);
      expect(RobotsPolicy.evaluate(rec, '/x')).toEqual({ allowed: true, crawlDelayMs: 1000 });
    }
  });
  it('5xx disallows for 24h', () => {
    const rec = RobotsPolicy.fromResponse(503, '', now);
    expect(RobotsPolicy.evaluate(rec, '/x').allowed).toBe(false);
    expect(RobotsPolicy.expiresAt(rec)).toBe(now + ROBOTS_TTL_MS);
    expect(RobotsPolicy.isFresh(rec, now + ROBOTS_TTL_MS - 1)).toBe(true);
    expect(RobotsPolicy.isFresh(rec, now + ROBOTS_TTL_MS)).toBe(false);
  });
  it('401/403 and network error disallow', () => {
    expect(RobotsPolicy.evaluate(RobotsPolicy.fromResponse(401, '', now), '/').allowed).toBe(false);
    expect(RobotsPolicy.evaluate(RobotsPolicy.fromResponse(403, '', now), '/').allowed).toBe(false);
    expect(RobotsPolicy.evaluate(RobotsPolicy.fromError(now), '/').allowed).toBe(false);
  });
  it('200 uses rules and Crawl-delay', () => {
    const rec = RobotsPolicy.fromResponse(200, 'User-agent: *\nCrawl-delay: 3\nDisallow: /no', now);
    expect(RobotsPolicy.evaluate(rec, '/no')).toEqual({ allowed: false, crawlDelayMs: 3000 });
    expect(RobotsPolicy.evaluate(rec, '/yes')).toEqual({ allowed: true, crawlDelayMs: 3000 });
  });
  it('crawl delay below 1s is raised to 1s', () => {
    const rec = RobotsPolicy.fromResponse(200, 'User-agent: *\nCrawl-delay: 0.2', now);
    expect(RobotsPolicy.evaluate(rec, '/').crawlDelayMs).toBe(1000);
  });
});

describe('InMemoryRobotsStore', () => {
  it('stores by host case-insensitively', async () => {
    const s = new InMemoryRobotsStore();
    expect(await s.get('A.test')).toBeNull();
    const rec = RobotsPolicy.fromError(1);
    await s.put('A.test', rec);
    expect(await s.get('a.test')).toBe(rec);
  });
});
