/** Agency classifier shared types. Pure TS, no I/O. */

export interface ClassifyInput {
  title: string;
  company: string;
  /** Company's own website domain, if known (e.g. "acme.com"). */
  companyDomain?: string;
  /** Apply host or full apply URL (e.g. "boards.greenhouse.io/acme" or "https://jobs.lever.co/acme/123"). */
  applyHost?: string;
  excerpt: string;
  /** US SIC (e.g. "7363") or UK SIC 2007 (e.g. "78200") of the company. */
  sicCode?: string;
  country?: string;
}

export type AgencyFlag = 'yes' | 'no' | 'pending';

export interface ClassifyResult {
  /** Probability the post is from a staffing agency, 0..1. */
  score: number;
  flag: AgencyFlag;
  reasons: string[];
}

/** Sparse hashed feature vector: index -> value. */
export type FeatureVector = Map<number, number>;

export interface AgencyModel {
  /** Probability of agency, 0..1. */
  predict(features: FeatureVector): number;
  /** Optional IDF table (hashed index -> idf) the features must be built with. */
  readonly idf?: ReadonlyMap<number, number>;
}

/** Editable rule data (mirrors the AgencyRule table: kind domain/name/phrase/sic). */
export interface AgencyRules {
  domains: string[];
  names: string[];
  phrases: string[];
  sicCodes: string[];
}

/** Policy (brief: review band 0.35-0.65). score >= 0.65 yes, <= 0.35 no, else pending. */
export const AGENCY_YES_THRESHOLD = 0.65;
export const AGENCY_NO_THRESHOLD = 0.35;

export function flagForScore(score: number): AgencyFlag {
  if (score >= AGENCY_YES_THRESHOLD) return 'yes';
  if (score <= AGENCY_NO_THRESHOLD) return 'no';
  return 'pending';
}
