import { createClassifier } from "@/lib/classify/classify";
import { SEED_RULES } from "@/lib/classify/seed-agencies";
import type { ClassifyInput, ClassifyResult } from "@/lib/classify/types";
import { getAdapter } from "@/lib/crawl/adapters";
import { RateLimitedError } from "@/lib/crawl/adapters/common";
import { crawlCareerSite } from "@/lib/crawl/careers/crawlCareerSite";
import { jaccardEstimate, dedupeKey, minhash } from "@/lib/crawl/dedupe/minhash";
import { RobotsDisallowedError } from "@/lib/crawl/net/fetchPolite";
import { normLocation } from "@/lib/crawl/normalize";
import { ageDays, ghostScore, repostCount90d } from "@/lib/crawl/score/ghost";
import type { Fetcher, NormalizedJob } from "@/lib/crawl/types";
import type { Db } from "@/lib/db/types";
import { cadence } from "@/config/product";
import { fieldOfTitle, hourlyEquivalent, levelOfTitle, scheduleOf } from "./fields";
import { jobId } from "./ids";
import type { EmployerDoc, JobUpsert } from "./types";

/** A board is due again this long after a good crawl; one daily run always finds it due (cadence in product.ts). */
export const CRAWL_INTERVAL_MS = cadence.crawlEveryHours * 60 * 60 * 1000;
export const MAX_FAILS = 3;
/** Near duplicate threshold within one board crawl (brief: Jaccard 0.85). */
const NEAR_DUP = 0.85;

export type Classifier = (i: ClassifyInput) => ClassifyResult;
/** Rules only until the precision gate passes (D-004): no model is passed here. */
export const rulesOnlyClassifier: Classifier = createClassifier({ rules: SEED_RULES });

export interface BuildResult {
  upserts: JobUpsert[];
  /** Outside the 8 fields (not stored, D-010). */
  outsideFields: number;
  duplicates: number;
  agencyHidden: number;
}

/**
 * Pure: turns a board's normalised jobs into rows to upsert. Drops jobs outside the 8 fields, collapses near
 * duplicates (same key and MinHash Jaccard >= 0.85), classifies agency posts, and scores repost and ghost signals.
 * `history` = earlier rows with the same dedupe keys; rows still listed in this crawl are not reposts.
 */
export function buildUpserts(
  employer: Pick<EmployerDoc, "id" | "name" | "domain" | "sicCode">,
  jobs: NormalizedJob[],
  opts: { now: Date; classify: Classifier; history?: { id: string; dedupeKey: string; firstSeenAt: Date }[] },
): BuildResult {
  const { now, classify } = opts;
  const listed = new Set(jobs.map((j) => jobId(employer.id, j.externalId)));
  const history = (opts.history ?? []).filter((h) => !listed.has(h.id));
  const kept = new Map<string, Uint32Array[]>();
  const upserts: JobUpsert[] = [];
  let outsideFields = 0;
  let duplicates = 0;
  let agencyHidden = 0;
  for (const j of jobs) {
    if (!j.country) continue;
    const field = fieldOfTitle(j.titleNorm);
    if (!field) { outsideFields++; continue; }
    const key = dedupeKey({ companyId: employer.id, titleNorm: j.titleNorm, locationNorm: normLocation(j.location) });
    const sig = minhash(`${j.titleNorm} ${j.excerpt}`);
    const seen = kept.get(key) ?? [];
    if (seen.some((s) => jaccardEstimate(s, sig) >= NEAR_DUP)) { duplicates++; continue; }
    kept.set(key, [...seen, sig]);
    const cls = classify({
      title: j.title, company: employer.name, companyDomain: employer.domain, applyHost: j.applyUrl,
      excerpt: j.excerpt, sicCode: employer.sicCode, country: j.country,
    });
    if (cls.flag === "yes") agencyHidden++;
    const reposts = repostCount90d(history.filter((h) => h.dedupeKey === key), now);
    upserts.push({
      id: jobId(employer.id, j.externalId),
      employerId: employer.id,
      employerName: employer.name,
      ats: j.ats,
      externalId: j.externalId,
      title: j.title,
      titleNorm: j.titleNorm,
      field,
      level: levelOfTitle(j.titleNorm),
      schedule: scheduleOf(j.title, j.excerpt),
      excerpt: j.excerpt,
      country: j.country,
      region: j.region,
      location: j.location,
      remoteType: j.remoteType,
      payMin: j.payMin,
      payMax: j.payMax,
      payPeriod: j.payPeriod,
      currency: j.currency,
      payHourlyMax: hourlyEquivalent(j.payMax ?? j.payMin, j.payPeriod),
      applyUrl: j.applyUrl,
      sourceHost: j.sourceHost,
      firstPublishedAt: j.firstPublishedAt,
      validThrough: j.validThrough,
      repostCount90d: reposts,
      ghostScore: ghostScore({ ageDays: ageDays(j.firstPublishedAt, now), repostCount90d: reposts, validThrough: j.validThrough, now }),
      agencyFlag: cls.flag,
      agencyScore: cls.score,
      dedupeKey: key,
    });
  }
  return { upserts, outsideFields, duplicates, agencyHidden };
}

export interface EmployerOutcome {
  employerId: string;
  seen: number;
  inserted: number;
  updated: number;
  closed: number;
  agencyHidden: number;
  notModified: boolean;
  error?: string;
}

/** Crawl one employer through `fetcher`, upsert its jobs, close the ones that vanished, update its crawl state. */
export async function ingestEmployer(
  deps: { db: Db; fetcher: Fetcher; now: Date; classify?: Classifier },
  employer: EmployerDoc,
): Promise<EmployerOutcome> {
  const { db, fetcher, now } = deps;
  const classify = deps.classify ?? rulesOnlyClassifier;
  const out: EmployerOutcome = { employerId: employer.id, seen: 0, inserted: 0, updated: 0, closed: 0, agencyHidden: 0, notModified: false };
  try {
    let jobs: NormalizedJob[] = [];
    let etag = employer.etag;
    let closedUrls: string[] = [];
    let fullListing = true;
    if (employer.ats === "jsonld") {
      const origin = new URL(employer.careersUrl ?? `https://${employer.slug}`).origin;
      const r = await crawlCareerSite({ host: new URL(origin).host, robotsSitemaps: [`${origin}/sitemap.xml`], fetcher, maxUrls: 40, now });
      if (r.blocked) throw new RobotsDisallowedError(origin);
      jobs = r.jobs;
      closedUrls = r.closedUrls;
      fullListing = false; // capped crawl: only closedUrls close jobs
    } else {
      const adapter = getAdapter(employer.ats);
      if (!adapter) throw new Error(`no adapter for ${employer.ats}`);
      const res = await adapter.crawl({ ats: employer.ats, slug: employer.slug, region: employer.region, etag } as never, fetcher);
      etag = res.etag ?? etag;
      out.notModified = !!res.notModified;
      jobs = res.jobs;
    }
    out.seen = jobs.length;
    if (!out.notModified) {
      const history = await db.jobsByDedupeKeys([
        ...new Set(jobs.map((j) => dedupeKey({ companyId: employer.id, titleNorm: j.titleNorm, locationNorm: normLocation(j.location) }))),
      ]);
      const built = buildUpserts(employer, jobs, { now, classify, history });
      out.agencyHidden = built.agencyHidden;
      const r = await db.upsertJobs(built.upserts, now);
      out.inserted = r.inserted;
      out.updated = r.updated;
      // Missing on 2 consecutive crawls closes a job (DATA-07). Never close on an empty answer: that is more likely an outage.
      if (fullListing && jobs.length > 0) out.closed = await db.closeMissing(employer.id, jobs.map((j) => j.externalId), now);
      if (closedUrls.length) out.closed += await db.closeByExternalIds(employer.id, closedUrls, now);
    }
    await db.patchEmployer(employer.id, { failCount: 0, etag, status: "active", lastCrawledAt: now, nextCrawlAt: new Date(now.getTime() + CRAWL_INTERVAL_MS) });
  } catch (e) {
    out.error = (e as Error).message;
    if (e instanceof RobotsDisallowedError) {
      await db.patchEmployer(employer.id, { status: "blocked", lastCrawledAt: now });
    } else if (e instanceof RateLimitedError) {
      await db.patchEmployer(employer.id, { nextCrawlAt: new Date(now.getTime() + Math.max(e.retryAfterMs ?? 0, 30 * 60 * 1000)) });
    } else {
      const failCount = employer.failCount + 1;
      await db.patchEmployer(employer.id, {
        failCount,
        lastCrawledAt: now,
        status: failCount >= MAX_FAILS ? "dead" : "active",
        nextCrawlAt: new Date(now.getTime() + CRAWL_INTERVAL_MS * 2 ** Math.min(failCount, 5)),
      });
    }
  }
  return out;
}
