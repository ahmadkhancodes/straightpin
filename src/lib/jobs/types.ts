import type { AtsKind, Country, PayPeriod, RemoteType } from "@/lib/crawl/types";
import type { AgencyFlag } from "@/lib/classify/types";
import type { FieldId, Level, Schedule } from "./fields";

export type { FieldId, Level, Schedule };

/** One source on the list: an employer board (or a careers site). Collection `employers`. */
export interface EmployerDoc {
  id: string; // `${ats}:${slug}` (careers sites: `jsonld:${host}`)
  name: string;
  ats: AtsKind;
  slug: string;
  region?: "eu" | "us";
  /** jsonld only: the careers site origin. */
  careersUrl?: string;
  domain?: string;
  sicCode?: string;
  status: "active" | "dead" | "blocked";
  failCount: number;
  etag?: string;
  lastCrawledAt: Date | null;
  nextCrawlAt: Date;
  suppressed: boolean;
  /** True for rows that came from the seed list (src/lib/jobs/sources.json). */
  seed: boolean;
}
export type EmployerSeed = Pick<EmployerDoc, "name" | "ats" | "slug"> & Partial<Pick<EmployerDoc, "region" | "careersUrl" | "domain" | "sicCode">>;

/** Collection `jobs`: facts, a short excerpt and a link to the employer's own page (D-001). */
export interface JobDoc {
  id: string;
  employerId: string;
  employerName: string;
  ats: AtsKind;
  externalId: string;
  title: string;
  titleNorm: string;
  field: FieldId;
  level: Level;
  schedule: Schedule;
  excerpt: string;
  country: Country;
  region: string | null;
  location: string | null;
  remoteType: RemoteType;
  payMin: number | null;
  payMax: number | null;
  payPeriod: PayPeriod | null;
  currency: "USD" | "CAD" | "GBP" | "EUR" | null;
  /** Hourly equivalent of payMax, for the pay floor question. */
  payHourlyMax: number | null;
  applyUrl: string;
  sourceHost: string;
  /** The company's own first published date. Never an updated_at. Null when the source gives none. */
  firstPublishedAt: Date | null;
  validThrough: Date | null;
  firstSeenAt: Date;
  /** firstPublishedAt, else firstSeenAt: the sort key. */
  postedAt: Date;
  lastSeenAt: Date;
  closedAt: Date | null;
  missCount: number;
  repostCount90d: number;
  ghostScore: number;
  agencyFlag: AgencyFlag;
  agencyScore: number;
  dedupeKey: string;
}
export type JobUpsert = Omit<JobDoc, "firstSeenAt" | "lastSeenAt" | "closedAt" | "missCount" | "postedAt">;

export interface JobQuery {
  field?: FieldId;
  country?: Country;
  remoteTypes?: RemoteType[];
  /** Hourly pay floor. Jobs with no pay shown stay in. */
  payFloor?: number;
  levels?: Level[];
  schedule?: Schedule;
  /** Default false: staffing agency posts are hidden. */
  includeAgency?: boolean;
  firstSeenAfter?: Date;
  limit?: number;
  skip?: number;
}

export interface SourceRun {
  id: string;
  kind: "crawl-tick";
  startedAt: Date;
  finishedAt: Date;
  employers: number;
  jobsSeen: number;
  inserted: number;
  updated: number;
  closed: number;
  agencyHidden: number;
  errors: { employerId: string; message: string }[];
  /** Per board result of this run (M3, crawl health). Older rows do not have it. */
  boards?: { employerId: string; ok: boolean; inserted: number; closed: number }[];
  budgetHit: boolean;
}

/** The quiz answers plus delivery settings. Collection `search_profiles`, keyed by the billing org id. */
export interface SearchProfile {
  orgId: string;
  email: string;
  field: FieldId;
  country: Country;
  remote: "remote" | "remote_hybrid" | "any";
  payFloor: number;
  level: "entry" | "mid" | "senior" | "any";
  schedule: "full" | "part" | "any";
  tz: string;
  digest: boolean;
  alerts: boolean;
  lastDigestAt: Date | null;
  lastAlertAt: Date | null;
  updatedAt: Date;
}

export interface SavedJob { orgId: string; jobId: string; savedAt: Date }
