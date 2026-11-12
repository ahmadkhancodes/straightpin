import { ageDays, isOldPosting, postedLabel } from "@/lib/crawl/score/ghost";
import type { JobDoc } from "./types";

const SYMBOL = { USD: "$", CAD: "C$", GBP: "£", EUR: "€" } as const;
const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(2));

/** "$19 to $24 an hour", "£24,500 a year", or null when the company shows no pay. */
export function formatPay(j: Pick<JobDoc, "payMin" | "payMax" | "payPeriod" | "currency">): string | null {
  const lo = j.payMin ?? j.payMax;
  const hi = j.payMax ?? j.payMin;
  if (lo === null || hi === null || !j.payPeriod) return null;
  const sym = j.currency ? SYMBOL[j.currency] : "$";
  const per = j.payPeriod === "hour" ? "an hour" : j.payPeriod === "year" ? "a year" : `a ${j.payPeriod}`;
  return lo === hi ? `${sym}${fmt(lo)} ${per}` : `${sym}${fmt(lo)} to ${sym}${fmt(hi)} ${per}`;
}

export const repostText = (n: number) => (n === 0 ? "Never reposted" : n === 1 ? "Reposted once" : `Reposted ${n} times`);

export function postedInfo(j: Pick<JobDoc, "firstPublishedAt">, now: Date) {
  const age = ageDays(j.firstPublishedAt, now);
  return { label: postedLabel(j.firstPublishedAt, now), age, old: isOldPosting(age) };
}

export const placeOf = (j: Pick<JobDoc, "remoteType" | "location" | "country">) =>
  [
    j.remoteType === "hybrid" && !/hybrid/i.test(j.location ?? "") ? "Hybrid" : null,
    j.location ?? (j.remoteType === "remote" ? "Remote" : null),
    j.remoteType === "remote" && j.location && !/remote/i.test(j.location) ? "Remote" : null,
    j.country,
  ].filter(Boolean).join(", ");

export function checkedAgo(at: Date, now: Date): string {
  const m = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60000));
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

/** When the free daily opens come back, in words a person can act on: "in 7 hours (midnight UTC)". */
export function resetPhrase(now: Date = new Date()): string {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const hours = Math.floor((next - now.getTime()) / 3_600_000);
  const when = hours < 1 ? "in under an hour" : `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${when} (midnight UTC)`;
}
