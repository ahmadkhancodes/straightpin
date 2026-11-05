import { effectivePlan } from "@/lib/billing/entitlement";
import type { Db } from "@/lib/db/types";
import { appUrl } from "@/lib/env";
import { log } from "@/lib/logger";
import { manageUrl, sendMail, unsubscribeUrl } from "@/lib/mail";
import type { MailMessage, SendResult } from "@/lib/mail";
import { digestEmail, type DigestJob } from "@/lib/mail/templates";
import { agencyReceipt } from "@/lib/classify/classify";
import { answersFromProfile, queryFromAnswers, rankJobs } from "./matching";
import { alertLimitFor, ruleLabel, withinLimit } from "./alertRules";
import { fieldLabel } from "./fields";
import type { AlertRule, JobDoc, SearchProfile } from "./types";

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

/** One failed email (provider down, bad address) must not stop the hourly run for everyone after it (REVIEW P1-7). */
async function trySend(send: SendFn, msg: Parameters<SendFn>[0]): Promise<boolean> {
  try {
    await send(msg);
    return true;
  } catch (e) {
    log.warn("mail_send_failed", { message: (e as Error).message });
    return false;
  }
}

export const jobUrl = (id: string) => `${appUrl()}/job/${id}`;

const place = (j: JobDoc) => [j.remoteType === "remote" ? "Remote" : j.location, j.country].filter(Boolean).join(", ");

/** Pure: the message for one profile and its new jobs. Null when there is nothing to say (never send an empty email). */
export function buildDigest(
  profile: SearchProfile,
  fresh: JobDoc[],
  opts: { kind: "digest" | "alerts"; now: Date; unsubscribeUrl: string; total?: number; agencyHidden?: number; matchesUrl?: string; manageUrl?: string; label?: string },
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
    manageUrl: opts.manageUrl,
    label: opts.label,
    receipt: opts.agencyHidden ? agencyReceipt(opts.agencyHidden) : undefined,
  });
  return { to: profile.email, subject: mail.subject, text: mail.text, html: mail.html, category: opts.kind, tags: { kind: opts.kind } };
}

/** `failed`: the mail provider refused or was down for that one email; the run carries on with the next person. */
export interface MailRunResult { considered: number; sent: number; skipped: number; failed: number }

const isPaid = async (db: Db, orgId: string, now: Date) => effectivePlan(await db.getEntitlement(orgId), now.getTime()).id !== "free";

/** Hourly cron. Free users get one digest at 08:00 local; paid users get instant alerts instead. */
export async function runDigest(db: Db, now: Date, send: SendFn = defaultSend, unsub: (email: string, scope: string) => Promise<string> = unsubscribeUrl, manage: (email: string) => Promise<string> = manageUrl): Promise<MailRunResult> {
  const res: MailRunResult = { considered: 0, sent: 0, skipped: 0, failed: 0 };
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
    const msg = buildDigest(p, fresh, { kind: "digest", now, total, unsubscribeUrl: await unsub(p.email, "digest"), manageUrl: await manage(p.email), agencyHidden });
    if (msg) {
      if (!(await trySend(send, msg))) {
        res.failed++;
        continue; // not marked as sent, so a provider outage does not silently swallow it
      }
      res.sent++;
    } else res.skipped++;
    await db.saveProfile({ ...p, lastDigestAt: now });
  }
  return res;
}

/** A rule as a profile, so the same ranking and email code serves quiz profiles and saved alerts. */
const ruleAsProfile = (r: AlertRule, tz: string): SearchProfile => ({
  orgId: r.orgId, email: r.email, field: r.field, country: r.country, remote: "any", payFloor: r.payFloor, level: "any", schedule: "any", tz,
  digest: false, alerts: true, lastDigestAt: null, lastAlertAt: r.lastSentAt, updatedAt: r.createdAt,
});

/**
 * Hourly cron. Paid users get the new matches since the last alert, once an hour at most, for each saved alert
 * (up to the plan's number). An account with no saved alerts but the quiz alert switched on keeps one alert from its quiz answers.
 */
export async function runAlerts(db: Db, now: Date, send: SendFn = defaultSend, unsub: (email: string, scope: string) => Promise<string> = unsubscribeUrl, manage: (email: string) => Promise<string> = manageUrl): Promise<MailRunResult> {
  const res: MailRunResult = { considered: 0, sent: 0, skipped: 0, failed: 0 };
  const byOrg = new Map<string, AlertRule[]>();
  for (const r of await db.listActiveAlertRules()) byOrg.set(r.orgId, [...(byOrg.get(r.orgId) ?? []), r]);
  const profiles = await db.listProfiles({ alerts: true });
  const sendFor = async (p: SearchProfile, extra: { locationTerms?: string[]; label?: string }, save: (at: Date) => Promise<void>) => {
    const since = p.lastAlertAt ?? new Date(now.getTime() - HOUR);
    const q = { ...queryFromAnswers(answersFromProfile(p)), ...(extra.locationTerms ? { locationTerms: extra.locationTerms } : {}), firstSeenAfter: since };
    const [total, fresh] = await Promise.all([db.countJobs(q), db.queryJobs({ ...q, limit: 50 })]);
    const msg = buildDigest(p, fresh, { kind: "alerts", now, total, unsubscribeUrl: await unsub(p.email, "alerts"), manageUrl: await manage(p.email), label: extra.label });
    if (msg) {
      if (!(await trySend(send, msg))) {
        res.failed++;
        return; // retried next hour with the same "since"
      }
      res.sent++;
    } else res.skipped++;
    await save(now);
  };
  const eligible = async (orgId: string, email: string, last: Date | null) =>
    (await alertLimitFor(db, orgId, now)) > 0 && !(await db.isSuppressed(email, "alerts")) && !(last && now.getTime() - last.getTime() < 50 * 60_000);

  for (const [orgId, rules] of byOrg) {
    const limit = await alertLimitFor(db, orgId, now);
    const all = await db.listAlertRules(orgId); // creation order, including paused ones, so a pause does not shift which rules count
    const allowed = new Set(withinLimit(all, limit).map((r) => r.id));
    const profile = await db.getProfile(orgId);
    for (const r of rules) {
      res.considered++;
      if (!allowed.has(r.id) || !(await eligible(orgId, r.email, r.lastSentAt))) {
        res.skipped++;
        continue;
      }
      await sendFor(ruleAsProfile(r, profile?.tz ?? "UTC"), { locationTerms: r.location ? [r.location] : undefined, label: ruleLabel(r, fieldLabel(r.field)) }, (at) => db.saveAlertRule({ ...r, lastSentAt: at }));
    }
  }
  for (const p of profiles) {
    if (byOrg.has(p.orgId) || (await db.listAlertRules(p.orgId)).length) continue;
    res.considered++;
    if (!(await eligible(p.orgId, p.email, p.lastAlertAt))) {
      res.skipped++;
      continue;
    }
    await sendFor(p, {}, (at) => db.saveProfile({ ...p, lastAlertAt: at }));
  }
  return res;
}
