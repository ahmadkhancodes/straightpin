import { describe, expect, it } from 'vitest';
import { ageDays, ghostScore, ghostSignals, isOldPosting, postedLabel, repostCount90d } from './ghost';

const NOW = new Date('2026-11-05T12:00:00Z');
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);
const H = 3_600_000;
const D = 24 * H;

describe('ageDays / isOldPosting', () => {
  it('computes whole days and null for unknown', () => {
    expect(ageDays(ago(41 * D + 3 * H), NOW)).toBe(41);
    expect(ageDays(null, NOW)).toBeNull();
    expect(ageDays(new Date(NOW.getTime() + D), NOW)).toBe(0);
  });
  it('boundary: 30 days is not old, 31 is', () => {
    expect(isOldPosting(30)).toBe(false);
    expect(isOldPosting(31)).toBe(true);
    expect(isOldPosting(ageDays(ago(30 * D), NOW))).toBe(false);
    expect(isOldPosting(ageDays(ago(31 * D), NOW))).toBe(true);
    expect(isOldPosting(null)).toBe(false);
  });
});

describe('repostCount90d', () => {
  it('counts only sightings in the last 90 days', () => {
    const h = [{ firstSeenAt: ago(10 * D) }, { firstSeenAt: ago(89 * D) }, { firstSeenAt: ago(91 * D) }, { firstSeenAt: new Date(NOW.getTime() + D) }];
    expect(repostCount90d(h, NOW)).toBe(2);
    expect(repostCount90d([], NOW)).toBe(0);
  });
});

describe('ghostScore', () => {
  it('is 0 for a fresh job', () => {
    expect(ghostScore({ ageDays: 3, repostCount90d: 0, now: NOW })).toBe(0);
    expect(ghostScore({ ageDays: null, repostCount90d: 0, now: NOW })).toBe(0);
  });
  it('rises with age after day 30, not at 30', () => {
    expect(ghostScore({ ageDays: 30, repostCount90d: 0, now: NOW })).toBe(0);
    const s31 = ghostScore({ ageDays: 31, repostCount90d: 0, now: NOW });
    expect(s31).toBeGreaterThan(0);
    expect(ghostScore({ ageDays: 90, repostCount90d: 0, now: NOW })).toBeGreaterThan(s31);
  });
  it('adds reposts and expired validThrough and caps at 1', () => {
    const exp = ghostScore({ ageDays: 5, repostCount90d: 0, validThrough: ago(D), now: NOW });
    expect(exp).toBeCloseTo(0.3);
    expect(ghostScore({ ageDays: 5, repostCount90d: 2, now: NOW })).toBeCloseTo(0.3);
    expect(ghostScore({ ageDays: 400, repostCount90d: 10, validThrough: ago(D), now: NOW })).toBe(1);
    expect(ghostScore({ ageDays: 5, repostCount90d: 0, validThrough: new Date(NOW.getTime() + D), now: NOW })).toBe(0);
  });
  it('stays in 0..1', () => {
    for (const a of [0, 31, 100, 1000]) for (const r of [0, 1, 5]) {
      const s = ghostScore({ ageDays: a, repostCount90d: r, validThrough: ago(D), now: NOW });
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe('ghostSignals', () => {
  it('has plain honest labels', () => {
    const s = ghostSignals({ ageDays: 41, repostCount90d: 3, validThrough: ago(D), now: NOW });
    expect(s.map((x) => x.code)).toEqual(['old_posting', 'reposted', 'expired_validthrough']);
    expect(s[0]?.label).toBe('Old posting, 41 days');
    expect(s[1]?.label).toBe('Reposted 3 times');
    for (const x of s) expect(x.label).not.toMatch(/-/);
  });
  it('singular repost, no signals when clean, none at 30 days', () => {
    expect(ghostSignals({ ageDays: 2, repostCount90d: 1, now: NOW })[0]?.label).toBe('Reposted 1 time');
    expect(ghostSignals({ ageDays: 30, repostCount90d: 0, now: NOW })).toEqual([]);
    expect(ghostSignals({ ageDays: 31, repostCount90d: 0, now: NOW })).toHaveLength(1);
    expect(ghostSignals({ ageDays: null, repostCount90d: 0, now: NOW })).toEqual([]);
  });
});

describe('postedLabel', () => {
  it('formats hours, days, today', () => {
    expect(postedLabel(ago(10 * 60_000), NOW)).toBe('Posted today');
    expect(postedLabel(ago(5 * H + 10), NOW)).toBe('Posted 5 hours ago');
    expect(postedLabel(ago(1 * H), NOW)).toBe('Posted 1 hour ago');
    expect(postedLabel(ago(2 * D + H), NOW)).toBe('Posted 2 days ago');
    expect(postedLabel(ago(41 * D), NOW)).toBe('Posted 41 days ago');
    expect(postedLabel(ago(D), NOW)).toBe('Posted 1 day ago');
  });
  it('handles unknown date', () => {
    expect(postedLabel(null, NOW)).toBe('Posted date not shown by company');
  });
});
