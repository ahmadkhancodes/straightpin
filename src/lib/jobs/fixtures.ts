import { dedupeKey } from "@/lib/crawl/dedupe/minhash";
import { fieldOfTitle, hourlyEquivalent, levelOfTitle, scheduleOf, type FieldId } from "./fields";
import { jobId } from "./ids";
import type { JobUpsert } from "./types";

/** INVENTED jobs for tests and the e2e seed route. Never shown in production. */
type Row = [title: string, company: string, country: "US" | "CA" | "UK", remote: "remote" | "hybrid" | "onsite", place: string, pay: [number, number, "hour" | "year"] | null, daysAgo: number | null, reposts?: number, agency?: boolean];
const ROWS: Row[] = [
  ["Customer Support Specialist", "Brightwell Home Health", "US", "remote", "Remote", [19, 24, "hour"], 2],
  ["Member Care Representative", "Tidewater Credit Union", "US", "remote", "Remote", [18.5, 18.5, "hour"], 6],
  ["Customer Support Associate, Evenings", "Pinecrest Pet Supply", "US", "remote", "Remote", [17, 20, "hour"], 45, 1],
  ["Customer Service Representative", "Harbor Staffing Partners", "US", "remote", "Remote", [16, 18, "hour"], 3, 0, true],
  ["Part Time Customer Support Agent", "Lumen Books", "US", "remote", "Remote", [16, 16, "hour"], 8],
  ["Senior Customer Support Manager", "Fernhill Software", "US", "remote", "Remote", [70000, 85000, "year"], 4],
  ["Data Entry Clerk", "Harlow & Finch Logistics", "CA", "remote", "Remote", [22, 26, "hour"], 0],
  ["Records Entry Assistant", "Marlow County Library", "US", "hybrid", "Columbus, Ohio", [16.25, 16.25, "hour"], 4],
  ["Administrative Assistant", "Oakmere Council Services", "UK", "onsite", "Manchester", [24500, 24500, "year"], 41, 3],
  ["Executive Assistant", "Redfern Architects", "US", "remote", "Remote", [58000, 66000, "year"], 3],
  ["Project Coordinator", "Lakeshore Builders", "CA", "onsite", "Toronto", [62000, 62000, "year"], 8],
  ["Customer Success Associate", "Fernhill Software", "US", "remote", "Remote", [52000, 60000, "year"], 1],
  ["Operations Associate", "Granite Street Foods", "US", "remote", "Remote", [21, 21, "hour"], 12, 1],
  ["Accounts Payable Clerk", "Wexford Dental Group", "US", "remote", "Remote", [20, 23, "hour"], 5],
  ["Marketing Coordinator", "Kestrel Outdoor Co.", "UK", "hybrid", "London", [29000, 29000, "year"], 7],
  ["Customer Support Specialist", "Alder Home Goods", "US", "onsite", "Austin, Texas", null, null],
];

export const NOW = new Date("2026-11-05T12:00:00Z");

export function fixtureJobs(now: Date = NOW): JobUpsert[] {
  return ROWS.map(([title, company, country, remote, place, pay, daysAgo, reposts = 0, agency = false], i) => {
    const titleNorm = title.toLowerCase();
    const employerId = `greenhouse:${company.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
    const externalId = String(1000 + i);
    const host = "boards.greenhouse.io";
    const excerpt = `${title} at ${company}. ${agency ? "On behalf of our client, a growing company." : "Join our team."}`;
    const field = fieldOfTitle(titleNorm) as FieldId;
    return {
      id: jobId(employerId, externalId),
      employerId, employerName: company, ats: "greenhouse", externalId, title, titleNorm, field,
      level: levelOfTitle(titleNorm), schedule: scheduleOf(title, excerpt), excerpt, country, region: null, location: place,
      remoteType: remote,
      payMin: pay?.[0] ?? null, payMax: pay?.[1] ?? null, payPeriod: pay?.[2] ?? null, currency: pay ? (country === "UK" ? "GBP" : country === "CA" ? "CAD" : "USD") : null,
      payHourlyMax: pay ? hourlyEquivalent(pay[1], pay[2]) : null,
      applyUrl: `https://${host}/${employerId.split(":")[1]}/jobs/${externalId}`, sourceHost: host,
      firstPublishedAt: daysAgo === null ? null : new Date(now.getTime() - daysAgo * 86_400_000),
      validThrough: null, repostCount90d: reposts, ghostScore: reposts ? 0.15 * reposts : 0,
      agencyFlag: agency ? "yes" : "no", agencyScore: agency ? 0.9 : 0.2,
      dedupeKey: dedupeKey({ companyId: employerId, titleNorm, locationNorm: place.toLowerCase() }),
    };
  });
}

/** INVENTED extra rows so a few programmatic pages pass the minimum count in e2e: 10 Toronto and 10 remote support jobs. */
export function pageFixtureJobs(now: Date = NOW): JobUpsert[] {
  const tpl = fixtureJobs(now).find((j) => j.field === "support" && j.agencyFlag === "no")!;
  const employers = ["Northgate Clinics", "Cedar & Pine Retail", "Bluewater Insurance"];
  return Array.from({ length: 20 }, (_, i) => {
    const toronto = i < 10;
    const employerName = employers[i % 3]!;
    const employerId = `greenhouse:${employerName.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
    const externalId = `p${i}`;
    return {
      ...tpl, id: jobId(employerId, externalId), employerId, employerName, externalId,
      title: `Customer Support Specialist ${toronto ? "I" : "II"}`, titleNorm: `customer support specialist ${toronto ? "i" : "ii"}`,
      country: toronto ? "CA" : "US", location: toronto ? "Toronto, ON" : "Remote", remoteType: toronto ? "onsite" : "remote",
      payMin: 18 + (i % 5), payMax: 22 + (i % 5), payPeriod: "hour", currency: toronto ? "CAD" : "USD", payHourlyMax: 22 + (i % 5),
      firstPublishedAt: new Date(now.getTime() - (i + 1) * 86_400_000),
      applyUrl: `https://boards.greenhouse.io/${employerId.split(":")[1]}/jobs/${externalId}`,
      dedupeKey: dedupeKey({ companyId: employerId, titleNorm: `support ${i}`, locationNorm: toronto ? "toronto" : "remote" }),
    } as JobUpsert;
  });
}
