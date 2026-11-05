/** Shared contracts for crawlers. Pure TS, no framework imports. */
export type Country = 'US' | 'CA' | 'UK';
export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type PayPeriod = 'hour' | 'year' | 'month' | 'week' | 'day';
export type AtsKind = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'recruitee' | 'personio' | 'smartrecruiters' | 'jsonld';

/** One job as every adapter returns it, before DB upsert. */
export interface NormalizedJob {
  ats: AtsKind;
  externalId: string;            // unique per board
  title: string;
  titleNorm: string;
  excerpt: string;               // plain text, max 600 chars (D-001)
  country: Country | null;       // null = not US/CA/UK, caller drops it
  region: string | null;
  location: string | null;
  remoteType: RemoteType;
  payMin: number | null;
  payMax: number | null;
  payPeriod: PayPeriod | null;
  currency: 'USD' | 'CAD' | 'GBP' | 'EUR' | null;
  applyUrl: string;
  sourceHost: string;            // host of applyUrl
  firstPublishedAt: Date | null; // NEVER updated_at; null if source gives no real posted date
  validThrough: Date | null;
}

export interface FetchRequest { url: string; headers?: Record<string, string>; etag?: string; lastModified?: string }
export interface FetchResult { status: number; body: string; headers: Record<string, string>; notModified: boolean }

/** Everything crawlers use to touch the network. fetchPolite implements it; tests pass a fake. */
export interface Fetcher { fetch(req: FetchRequest): Promise<FetchResult> }

export interface BoardRef { ats: AtsKind; slug: string; region?: 'eu' | 'us' }
export interface AdapterResult { jobs: NormalizedJob[]; skipped: number; etag?: string; notModified?: boolean }
export interface AtsAdapter { ats: AtsKind; crawl(board: BoardRef, fetcher: Fetcher): Promise<AdapterResult> }

export const USER_AGENT = 'StraightpinByBufferSolBot (+https://straightpin.buffersoltech.com/bot)';
