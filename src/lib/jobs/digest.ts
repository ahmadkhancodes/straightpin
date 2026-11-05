import { effectivePlan } from "@/lib/billing/entitlement";
import type { Db } from "@/lib/db/types";
import { appUrl } from "@/lib/env";
import { sendMail, unsubscribeUrl } from "@/lib/mail";
import type { MailMessage, SendResult } from "@/lib/mail";
import { digestEmail, type DigestJob } from "@/lib/mail/templates";
import { agencyReceipt } from "@/lib/classify/classify";
import { answersFromProfile, queryFromAnswers, rankJobs } from "./matching";
import type { JobDoc, SearchProfile } from "./types";

export const DIGEST_HOUR = 8;
export const DIGEST_MAX_JOBS = 10;
/** Above this many new matches an alert becomes a summary (brief: > 20 new matches go to the digest shape). */
export const ALERT_SUMMARY_OVER = 20;
const HOUR = 3_600_000;

/** Local hour (0 to 23) in an IANA time zone. Falls back to UTC for an unknown zone. */
export function localHour(tz: string, now: Date): number {
  try {
    const h = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(now);
    return Number(h) % 24;
  } catch {
    return now.getUTCHours();
  }
}
export const isDigestHour = (tz: string, now: Date, hour = DIGEST_HOUR) => localHour(tz, now) === hour;

export type SendFn = (msg: MailMessage) => Promise<SendResult>;
export const defaultSend: SendFn = (m) => sendMail(m);

export const jobUrl = (id: string) => `${appUrl()}/job/${id}`;

const place = (j: JobDoc) => [j.remoteType === "remote" ? "Remote" : j.location, j.country].filter(Boolean).join(", ");

/** Pure: the message for one profile and its new jobs. Null when there is nothing to say (never send an empty email). */
export function buildDigest(
  profile: SearchProfile,
  fresh: JobDoc[],
  opts: { kind: "digest" | "alerts"; now: Date; unsubscribeUrl: string; total?: number; agencyHidden?: number; matchesUrl?: string },
): MailMessage | null {
  if (fresh.length === 0) return null;
  const ranked = rankJobs(fresh, answersFromProfile(profile), opts.now);
  const total = opts.total ?? fresh.length;
  const cap = opts.kind === "alerts" && total <= ALERT_SUMMARY_OVER ? ALERT_SUMMARY_OVER : DIGEST_MAX_JOBS;
  const jobs: DigestJob[] = ranked.slice(0, cap).map(({ job, reason }) => ({ title: job.title, company: job.employerName, place: place(job), line: reason, url: jobUrl(job.id) }));
  const mail = digestEmail({
    kind: opts.kind,
    total,
    jobs,
    moreUrl: opts.matchesUrl ?? `${appUrl()}/matches`,
    unsubscribeUrl: opts.unsubscribeUrl,
    receipt: opts.agencyHidden ? agencyReceipt(opts.agencyHidden) : undefined,
  });
  return { to: profile.email, subject: mail.subject, text: mail.text, html: mail.html, category: opts.kind, tags: { kind: opts.kind } };
}

export interface MailRunResult { considered: number; sent: number; skipped: number }

const isPaid = async (db: Db, orgId: string, now: Date) => effectivePlan(await db.getEntitlement(orgId), now.getTime()).id !== "free";

/** Hourly cron. Free users get one digest at 08:00 local; paid users get instant alerts instead. */
export async function runDigest(db: Db, now: Date, send: SendFn = defaultSend, unsub: (email: string, scope: string) => Promise<string> = unsubscribeUrl): Promise<MailRunResult> {
  const res: MailRunResult = { considered: 0, sent: 0, skipped: 0 };
  for (const p of await db.listProfiles({ digest: true })) {
    res.considered++;
    if (!isDigestHour(p.tz, now) || (p.lastDigestAt && now.getTime() - p.lastDigestAt.getTime() < 20 * HOUR) || (await isPaid(db, p.orgId, now)) || (await db.isSuppressed(p.email, "digest"))) {
      res.skipped++;
      continue;
    }
    const since = p.lastDigestAt ?? new Date(now.getTime() - 24 * HOUR);
    const q = { ...queryFromAnswers(answersFromProfile(p)), firstSeenAfter: since };
    const [total, agencyHidden] = await Promise.all([db.countJobs(q), db.countAgencyHidden(q)]);
    const fresh = await db.queryJobs({ ...q, limit: 50 });
    const msg = buildDigest(p, fresh, { kind: "digest", now, total, unsubscribeUrl: await unsub(p.email, "digest"), agencyHidden });
    if (msg) {
      await send(msg);
      res.sent++;
    } else res.skipped++;
    await db.saveProfile({ ...p, lastDigestAt: now });
  }
  return res;
}

/** Hourly cron. Paid users with alerts on get the new matches since the last alert. */
export async function runAlerts(db: Db, now: Date, send: SendFn = defaultSend, unsub: (email: string, scope: string) => Promise<string> = unsubscribeUrl): Promise<MailRunResult> {
  const res: MailRunResult = { considered: 0, sent: 0, skipped: 0 };
  for (const p of await db.listProfiles({ alerts: true })) {
    res.considered++;
    if (!(await isPaid(db, p.orgId, now)) || (await db.isSuppressed(p.email, "alerts"))) {
      res.skipped++;
      continue;
    }
    if (p.lastAlertAt && now.getTime() - p.lastAlertAt.getTime() < 50 * 60_000) {
      res.skipped++;
      continue;
    }
    const since = p.lastAlertAt ?? new Date(now.getTime() - HOUR);
    const q = { ...queryFromAnswers(answersFromProfile(p)), firstSeenAfter: since };
    const [total, fresh] = await Promise.all([db.countJobs(q), db.queryJobs({ ...q, limit: 50 })]);
    const msg = buildDigest(p, fresh, { kind: "alerts", now, total, unsubscribeUrl: await unsub(p.email, "alerts") });
    if (msg) {
      await send(msg);
      res.sent++;
    } else res.skipped++;
    await db.saveProfile({ ...p, lastAlertAt: now });
  }
  return res;
}
