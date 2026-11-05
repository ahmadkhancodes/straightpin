import type { AgencyRules } from './types';

/**
 * SEED DATA ONLY. A small, generic list of well known staffing brands so the rules
 * work on day one. The real list lives in the AgencyRule table and is edited in the
 * admin agency list editor (ADM-01/02); this file is just the initial seed.
 */

/** Registrable apply/company domains of known staffing agencies. */
export const SEED_AGENCY_DOMAINS: string[] = [
  'randstad.com',
  'adecco.com',
  'roberthalf.com',
  'manpower.com',
  'manpowergroup.com',
  'kellyservices.com',
  'insightglobal.com',
  'teksystems.com',
  'kforce.com',
  'hays.com',
  'reed.co.uk',
  'michaelpage.com',
  'aerotek.com',
  'volt.com',
  'apexsystems.com',
];

/** Company name fragments (token sequences, case insensitive). */
export const SEED_AGENCY_NAMES: string[] = [
  'randstad',
  'adecco',
  'robert half',
  'manpower',
  'kelly services',
  'insight global',
  'teksystems',
  'kforce',
  'hays',
  'reed',
  'michael page',
  'aerotek',
  'volt',
  'apex systems',
];

/** Phrases that suggest a recruiter wrote the post (soft signals). */
export const SEED_AGENCY_PHRASES: string[] = [
  'our client',
  'on behalf of our client',
  'staffing',
  'recruitment agency',
  'contract to hire via',
  'our client is a leading',
  'talent acquisition partner for',
];

/** US SIC 7363 help supply, 7361 employment agencies; UK SIC 78100/78200/78300. */
export const SEED_AGENCY_SIC_CODES: string[] = ['7363', '7361', '78100', '78200', '78300'];

export const SEED_RULES: AgencyRules = {
  domains: SEED_AGENCY_DOMAINS,
  names: SEED_AGENCY_NAMES,
  phrases: SEED_AGENCY_PHRASES,
  sicCodes: SEED_AGENCY_SIC_CODES,
};

/**
 * ATS hosts (direct employer boards). style "path": slug is the first path segment
 * (jobs.lever.co/acme); style "subdomain": slug is the subdomain (acme.myworkdayjobs.com).
 */
export const ATS_HOSTS: ReadonlyArray<{ host: string; style: 'path' | 'subdomain' }> = [
  { host: 'greenhouse.io', style: 'path' },
  { host: 'lever.co', style: 'path' },
  { host: 'ashbyhq.com', style: 'path' },
  { host: 'workable.com', style: 'path' },
  { host: 'smartrecruiters.com', style: 'path' },
  { host: 'myworkdayjobs.com', style: 'subdomain' },
  { host: 'icims.com', style: 'subdomain' },
  { host: 'bamboohr.com', style: 'subdomain' },
  { host: 'recruitee.com', style: 'subdomain' },
];
