const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
export const OLD_POSTING_DAYS = 30;

export type GhostCode = 'old_posting' | 'reposted' | 'expired_validthrough';
export interface GhostSignal { code: GhostCode; label: string; severity: 'low' | 'medium' | 'high' }
export interface GhostInput {
  ageDays: number | null;
  repostCount90d: number;
  validThrough?: Date | null;
  now: Date;
}

/**
 * Earlier postings of the same role (same dedupe key), excluding the current one.
 * Counts those first seen within the 90 days before `now`.
 */
export function repostCount90d(history: { firstSeenAt: Date }[], now: Date): number {
  const from = now.getTime() - 90 * DAY_MS;
  return history.filter((h) => {
    const t = h.firstSeenAt.getTime();
    return t >= from && t <= now.getTime();
  }).length;
}

/** Whole days since the company first published the job. Null when the company gave no date. */
export function ageDays(firstPublishedAt: Date | null, now: Date): number | null {
  if (!firstPublishedAt) return null;
  return Math.max(0, Math.floor((now.getTime() - firstPublishedAt.getTime()) / DAY_MS));
}

/** True when strictly older than 30 days (30 is fine, 31 is old). Unknown age is never old. */
export function isOldPosting(age: number | null): boolean {
  return age !== null && age > OLD_POSTING_DAYS;
}

function isExpired(validThrough: Date | null | undefined, now: Date): boolean {
  return !!validThrough && validThrough.getTime() < now.getTime();
}

/** 0 (looks fresh) to 1 (very likely a ghost). Sum of age, repost and expiry parts, capped at 1. */
export function ghostScore(i: GhostInput): number {
  let s = 0;
  if (isOldPosting(i.ageDays) && i.ageDays !== null) s += Math.min(0.5, 0.25 + (i.ageDays - OLD_POSTING_DAYS) / 120);
  if (i.repostCount90d > 0) s += Math.min(0.4, 0.15 * i.repostCount90d);
  if (isExpired(i.validThrough, i.now)) s += 0.3;
  return Math.min(1, Math.round(s * 1000) / 1000);
}

export function ghostSignals(i: GhostInput): GhostSignal[] {
  const out: GhostSignal[] = [];
  if (isOldPosting(i.ageDays) && i.ageDays !== null) {
    out.push({
      code: 'old_posting',
      label: `Old posting, ${i.ageDays} days`,
      severity: i.ageDays > 90 ? 'high' : i.ageDays > 60 ? 'medium' : 'low',
    });
  }
  if (i.repostCount90d > 0) {
    const n = i.repostCount90d;
    out.push({
      code: 'reposted',
      label: `Reposted ${n} ${n === 1 ? 'time' : 'times'}`,
      severity: n >= 3 ? 'high' : n === 2 ? 'medium' : 'low',
    });
  }
  if (isExpired(i.validThrough, i.now)) {
    out.push({ code: 'expired_validthrough', label: 'Past its closing date', severity: 'high' });
  }
  return out;
}

export function postedLabel(firstPublishedAt: Date | null, now: Date): string {
  if (!firstPublishedAt) return 'Posted date not shown by company';
  const diff = now.getTime() - firstPublishedAt.getTime();
  if (diff < HOUR_MS) return 'Posted today';
  if (diff < DAY_MS) {
    const h = Math.floor(diff / HOUR_MS);
    return `Posted ${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  }
  const d = Math.floor(diff / DAY_MS);
  return `Posted ${d} ${d === 1 ? 'day' : 'days'} ago`;
}
