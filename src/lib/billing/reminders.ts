import { planById, intervalText, product } from "@/config/product";
import type { Db, Entitlement } from "@/lib/db/types";
import { appUrl } from "@/lib/env";
import { sendMail, unsubscribeUrl } from "@/lib/mail";
import type { MailMessage } from "@/lib/mail";
import { renewalReminderEmail } from "@/lib/mail/templates";

const DAY = 864e5;
/** Weekly and monthly plans get the reminder this long before they renew. Annual plans get it on the day. */
export const REMINDER_LEAD_DAYS = 3;

/**
 * Pure scheduling rule. True when a reminder is due for this entitlement right now.
 *  - weekly / monthly: from 3 days before the renewal until it happens
 *  - annual: on the UTC day of the renewal, until it happens
 * Cancelling plans, lifetime, trials and past-due plans never get one (nothing renews, or the card already failed).
 */
export function reminderDue(e: Entitlement, now: number): boolean {
  if (!e.isPaid || e.status !== "active" || e.cancelAtPeriodEnd || !e.expiresAt || !e.interval) return false;
  if (e.expiresAt <= now) return false;
  if (e.interval === "week" || e.interval === "month") return e.expiresAt - now <= REMINDER_LEAD_DAYS * DAY;
  if (e.interval === "year") return new Date(e.expiresAt).toISOString().slice(0, 10) === new Date(now).toISOString().slice(0, 10);
  return false;
}

export interface ReminderResult { considered: number; sent: number; skipped: number }

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
const dateText = (ms: number) => new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(ms));

/** Hourly cron. One email per (org, renewal date), tracked by `markReminder`, with a one click unsubscribe. */
export async function runRenewalReminders(
  db: Db,
  now: Date,
  send: (m: MailMessage) => Promise<unknown> = (m) => sendMail(m),
  unsub: (email: string, scope: string) => Promise<string> = unsubscribeUrl,
): Promise<ReminderResult> {
  const res: ReminderResult = { considered: 0, sent: 0, skipped: 0 };
  for (const { orgId, entitlement: e } of await db.listEntitlements()) {
    res.considered++;
    if (!reminderDue(e, now.getTime())) { res.skipped++; continue; }
    const acct = await db.getBillingAccount(orgId);
    const plan = planById(e.plan);
    const price = plan?.prices.find((p) => p.interval === e.interval);
    if (!acct?.email || !plan || !price || (await db.isSuppressed(acct.email, "renewals"))) { res.skipped++; continue; }
    // Claim before sending: a crash after the claim loses one email, never sends two.
    if (!(await db.markReminder(`${orgId}|${e.expiresAt}`))) { res.skipped++; continue; }
    const m = renewalReminderEmail({
      planName: plan.name,
      amountText: money(price.usd),
      intervalText: intervalText(price.interval),
      dateText: dateText(e.expiresAt!),
      accountUrl: `${appUrl()}/account`,
      unsubscribeUrl: await unsub(acct.email, "renewals"),
    });
    await send({ to: acct.email, subject: m.subject, text: m.text, html: m.html, category: "renewals", tags: { kind: "renewal-reminder", app: product.slug } });
    res.sent++;
  }
  return res;
}
