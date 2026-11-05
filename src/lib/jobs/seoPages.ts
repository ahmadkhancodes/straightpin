import { product } from "@/config/product";
import { ageDays } from "@/lib/crawl/score/ghost";
import type { Country } from "@/lib/crawl/types";
import type { Db } from "@/lib/db/types";
import { FIELDS, fieldLabel, isFieldId, type FieldId } from "./fields";
import type { JobDoc, JobQuery } from "./types";

/**
 * Programmatic landing pages: /jobs/<field>/<location> for the 8 fields and the major US, Canada and UK places.
 * A page only exists while the database holds at least MIN_JOBS_FOR_PAGE open, non agency jobs for it
 * (a page with a handful of rows is thin content and would only dilute the site).
 */
export const MIN_JOBS_FOR_PAGE = 8;
/** Rows listed on a page. */
export const PAGE_LIST_SIZE = 25;

export interface LocationDef {
  slug: string;
  label: string;
  kind: "city" | "country" | "remote";
  /** City and country pages. Remote pages span all three countries. */
  country: Country | null;
  /** Case insensitive text matched against the job's place or region. */
  terms: string[];
}

const city = (slug: string, label: string, country: Country, terms: string[] = [label.split(",")[0]!.toLowerCase()]): LocationDef => ({ slug, label, kind: "city", country, terms });

export const LOCATIONS: LocationDef[] = [
  { slug: "remote", label: "Remote", kind: "remote", country: null, terms: [] },
  { slug: "united-states", label: "the United States", kind: "country", country: "US", terms: [] },
  { slug: "canada", label: "Canada", kind: "country", country: "CA", terms: [] },
  { slug: "united-kingdom", label: "the United Kingdom", kind: "country", country: "UK", terms: [] },
  city("new-york", "New York", "US", ["new york", "nyc", "brooklyn"]),
  city("los-angeles", "Los Angeles", "US"),
  city("chicago", "Chicago", "US"),
  city("houston", "Houston", "US"),
  city("phoenix", "Phoenix", "US"),
  city("philadelphia", "Philadelphia", "US"),
  city("san-antonio", "San Antonio", "US"),
  city("san-diego", "San Diego", "US"),
  city("dallas", "Dallas", "US"),
  city("austin", "Austin", "US"),
  city("san-francisco", "San Francisco", "US", ["san francisco", "bay area"]),
  city("seattle", "Seattle", "US"),
  city("denver", "Denver", "US"),
  city("boston", "Boston", "US"),
  city("atlanta", "Atlanta", "US"),
  city("miami", "Miami", "US"),
  city("toronto", "Toronto", "CA"),
  city("vancouver", "Vancouver", "CA"),
  city("montreal", "Montreal", "CA", ["montreal", "montréal"]),
  city("calgary", "Calgary", "CA"),
  city("ottawa", "Ottawa", "CA"),
  city("edmonton", "Edmonton", "CA"),
  city("london", "London", "UK"),
  city("manchester", "Manchester", "UK"),
  city("birmingham", "Birmingham", "UK"),
  city("leeds", "Leeds", "UK"),
  city("glasgow", "Glasgow", "UK"),
  city("edinburgh", "Edinburgh", "UK"),
  city("bristol", "Bristol", "UK"),
];

export const locationBySlug = (slug: string): LocationDef | undefined => LOCATIONS.find((l) => l.slug === slug);

/** The job query behind a page. */
export function pageQuery(field: FieldId, loc: LocationDef): JobQuery {
  const q: JobQuery = { field };
  if (loc.kind === "remote") q.remoteTypes = ["remote"];
  else if (loc.country) q.country = loc.country;
  if (loc.kind === "city") q.locationTerms = loc.terms;
  return q;
}

export const pagePath = (field: FieldId, loc: Pick<LocationDef, "slug">) => `/jobs/${field}/${loc.slug}`;

export interface PageCombo { field: FieldId; location: LocationDef; count: number }

/** Pure: keep only the combinations with enough jobs. Sorted by count, most jobs first, then by path so the order is stable. */
export function eligibleCombos(counts: PageCombo[], min = MIN_JOBS_FOR_PAGE): PageCombo[] {
  return counts
    .filter((c) => c.count >= min)
    .sort((a, b) => b.count - a.count || pagePath(a.field, a.location).localeCompare(pagePath(b.field, b.location)));
}

/** Count every field x location combination (8 fields x 33 places) and return the ones that qualify. Used by the sitemap and /jobs. */
export async function generatePages(db: Db, min = MIN_JOBS_FOR_PAGE): Promise<PageCombo[]> {
  const all = FIELDS.flatMap((f) => LOCATIONS.map((location) => ({ field: f.id, location })));
  const counts = await Promise.all(all.map(async (c) => ({ ...c, count: await db.countJobs(pageQuery(c.field, c.location)) })));
  return eligibleCombos(counts, min);
}

/** Resolve a URL to a page definition, or null when the slugs are unknown. The count is checked by the caller. */
export function resolvePage(field: string, location: string): { field: FieldId; location: LocationDef } | null {
  const loc = locationBySlug(location);
  return isFieldId(field) && loc ? { field, location: loc } : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Intros: sentences built from the rows themselves, so two pages never share boilerplate.

type Currency = "USD" | "CAD" | "GBP" | "EUR";

export interface PageStats {
  total: number;
  sampled: number;
  topEmployers: { name: string; count: number }[];
  employers: number;
  remote: number;
  hybrid: number;
  pay: { low: number; high: number; currency: Currency | null; withPay: number } | null;
  newestDays: number | null;
  postedThisWeek: number;
  oldPostings: number;
  topPlaces: string[];
}

/** Pure: the numbers an intro is written from. `jobs` is a sample of the newest rows, `total` the full count. */
export function pageStats(jobs: JobDoc[], total: number, now: Date): PageStats {
  const byEmployer = new Map<string, number>();
  const byPlace = new Map<string, number>();
  for (const j of jobs) {
    byEmployer.set(j.employerName, (byEmployer.get(j.employerName) ?? 0) + 1);
    if (j.location && j.remoteType !== "remote") byPlace.set(j.location, (byPlace.get(j.location) ?? 0) + 1);
  }
  const rank = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const paid = jobs.filter((j) => j.payHourlyMax !== null && j.currency);
  const currencies = new Map<string, number>();
  for (const j of paid) currencies.set(j.currency!, (currencies.get(j.currency!) ?? 0) + 1);
  const cur = (rank(currencies)[0]?.[0] ?? null) as Currency | null;
  const inCur = paid.filter((j) => j.currency === cur).map((j) => j.payHourlyMax!);
  const ages = jobs.map((j) => ageDays(j.firstPublishedAt, now)).filter((a): a is number => a !== null);
  return {
    total,
    sampled: jobs.length,
    topEmployers: rank(byEmployer).slice(0, 3).map(([name, count]) => ({ name, count })),
    employers: byEmployer.size,
    remote: jobs.filter((j) => j.remoteType === "remote").length,
    hybrid: jobs.filter((j) => j.remoteType === "hybrid").length,
    pay: inCur.length ? { low: Math.min(...inCur), high: Math.max(...inCur), currency: cur, withPay: inCur.length } : null,
    newestDays: ages.length ? Math.min(...ages) : null,
    postedThisWeek: ages.filter((a) => a <= 7).length,
    oldPostings: ages.filter((a) => a > 30).length,
    topPlaces: rank(byPlace).slice(0, 3).map(([p]) => p),
  };
}

const SYM = { USD: "$", CAD: "C$", GBP: "£", EUR: "€" } as const;
const money = (n: number, c: keyof typeof SYM | null) => `${SYM[c ?? "USD"]}${Number.isInteger(n) ? n : n.toFixed(2)}`;
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** Small stable hash, only used to vary sentence order and wording between pages. */
const h32 = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * Pure. Two or three short paragraphs about this field in this place, written from the stats. A sentence appears only when its
 * number exists, and the order and wording vary by page, so the intro is never the same text with the city swapped.
 */
export function buildIntro(field: FieldId, loc: LocationDef, s: PageStats): string[] {
  const f = fieldLabel(field).toLowerCase();
  const where = loc.kind === "remote" ? "remote" : `in ${loc.label}`;
  const seed = h32(`${field}/${loc.slug}`);
  const n = s.total;
  const lead = [
    `${plural(n, "open " + f + " job")} ${loc.kind === "remote" ? "that can be done remotely" : where} ${n === 1 ? "comes" : "come"} straight from company careers pages right now.`,
    `Right now we list ${plural(n, f + " job")} ${where}, each one taken from the employer's own careers page.`,
    `${n === 1 ? "One" : n.toLocaleString("en-US")} ${f} ${n === 1 ? "role is" : "roles are"} open ${where} today, and every one links to the company's own page.`,
  ][seed % 3]!;
  const para1 = [lead];
  if (s.topEmployers.length) {
    const named = s.topEmployers.map((e) => (e.count > 1 ? `${e.name} (${e.count})` : e.name));
    para1.push(s.employers > 3 ? `${s.employers} employers appear in the newest ${s.sampled}; ${list(named)} have the most.` : `The newest ${s.sampled} come from ${list(named)}.`);
  }
  const para2: string[] = [];
  if (s.pay) {
    const range = s.pay.low === s.pay.high ? `${money(s.pay.low, s.pay.currency)} an hour` : `${money(s.pay.low, s.pay.currency)} to ${money(s.pay.high, s.pay.currency)} an hour`;
    para2.push(`${s.pay.withPay} of the newest ${s.sampled} show pay, at ${range} (top of range, hourly equivalent).`);
  } else para2.push(`None of the newest ${s.sampled} show pay, so check the company's page before you spend time on an application.`);
  if (loc.kind !== "remote" && s.remote + s.hybrid > 0) para2.push(`${s.remote} of them are fully remote and ${s.hybrid} are hybrid.`);
  if (loc.kind === "country" && s.topPlaces.length) para2.push(`On site roles are mostly in ${list(s.topPlaces)}.`);
  const para3: string[] = [];
  if (s.newestDays !== null) {
    para3.push(s.newestDays === 0 ? "The newest was first posted today." : `The newest was first posted ${plural(s.newestDays, "day")} ago.`);
    para3.push(
      s.postedThisWeek > 0
        ? `${plural(s.postedThisWeek, "job")} went up in the last week${s.oldPostings ? `, and ${s.oldPostings} have been up for over 30 days and carry an Old posting tag` : ""}.`
        : s.oldPostings
          ? `${plural(s.oldPostings, "job")} here have been up for over 30 days and carry an Old posting tag.`
          : "",
    );
  }
  const paras = [para1.join(" "), para2.join(" "), para3.filter(Boolean).join(" ")].filter(Boolean);
  // Vary the order of the two detail paragraphs by page so the shape differs too.
  if (paras.length === 3 && (seed >> 3) % 2) [paras[1], paras[2]] = [paras[2]!, paras[1]!];
  return paras;
}

export function pageTitle(field: FieldId, loc: LocationDef): string {
  const f = fieldLabel(field);
  return loc.kind === "remote" ? `Remote ${f.toLowerCase()} jobs direct from company` : `${f} jobs in ${loc.label} direct from company`;
}

export function pageDescription(field: FieldId, loc: LocationDef, s: PageStats): string {
  const where = loc.kind === "remote" ? "remote" : `in ${loc.label}`;
  const parts = [`${s.total.toLocaleString("en-US")} ${fieldLabel(field).toLowerCase()} jobs ${where}, straight from company careers pages`];
  if (s.pay) parts.push(`pay from ${money(s.pay.low, s.pay.currency)} an hour`);
  parts.push("staffing agencies removed");
  return `${parts.join(", ")}. First posted dates and repost counts on every job.`;
}

/** Absolute canonical address of a page. */
export const pageCanonical = (field: FieldId, loc: Pick<LocationDef, "slug">) => `${product.url}${pagePath(field, loc)}`;

const CACHE_MS = 5 * 60_000;
let cached: { at: number; db: Db; min: number; value: Promise<PageCombo[]> } | null = null;

/** generatePages with a short per instance cache: /jobs and the sitemap both call it and it costs 8 x 33 count queries. */
export function generatePagesCached(db: Db, min = MIN_JOBS_FOR_PAGE, now = Date.now()): Promise<PageCombo[]> {
  if (cached && cached.db === db && cached.min === min && now - cached.at < CACHE_MS) return cached.value;
  const value = generatePages(db, min);
  cached = { at: now, db, min, value };
  value.catch(() => { if (cached?.value === value) cached = null; });
  return value;
}

export const clearPagesCache = () => { cached = null; };
