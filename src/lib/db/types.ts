// The one app-data interface (ported from trayo server/db/Db.ts; sync/family/anonymous removed).
// Users, sessions, orgs, members and API keys belong to Better Auth (its own adapter, same database).
// Billing is per organization ("subject" = org id). Every document carries `app` so a shared cluster stays safe.
// TTL fields are BSON Dates (the apps stored numbers, so Mongo TTL never fired: BACKEND_REUSE 1.5).

import type { PlanId } from "@/config/product";
import type { AgencyFlag, ClassifyInput } from "@/lib/classify/types";
import type { EmployerDoc, EmployerSeed, JobDoc, JobQuery, JobUpsert, SavedJob, SearchProfile, SourceRun } from "@/lib/jobs/types";

export type EntitlementStatus = "none" | "trialing" | "active" | "past_due" | "canceled" | "lifetime";

export interface Entitlement {
  /** Paid plan is live (trialing/active/past_due within grace, or lifetime). */
  isPaid: boolean;
  status: EntitlementStatus;
  plan: PlanId;
  interval: "week" | "month" | "year" | "once" | null;
  /** ms epoch; checked at read time so a missed webhook cannot leave a plan on forever. */
  expiresAt: number | null;
  trialStartedAt: number | null;
  cancelAtPeriodEnd: boolean;
  checkedAt: number;
  trialUsed: boolean;
  subscriptionId: string | null;
  lifetimePaymentIntentId: string | null;
  /** First time we saw past_due (for grace-period display). */
  pastDueSince: number | null;
}

export interface BillingAccount {
  /** org id */
  id: string;
  app: string;
  stripeCustomerId: string | null;
  email: string | null;
  createdAt: Date;
}

export interface AuditEntry {
  id: string;
  app: string;
  orgId: string | null;
  actorId: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, string | number | boolean | null>;
  ip?: string | null;
  at: Date;
}

export interface WebhookEndpoint {
  id: string;
  app: string;
  orgId: string;
  url: string;
  /** Signing secret (whsec_...). Shown once on create. */
  secret: string;
  events: string[];
  enabled: boolean;
  createdAt: Date;
}

export type DeliveryStatus = "pending" | "succeeded" | "failed" | "retrying";

export interface WebhookDelivery {
  id: string;
  app: string;
  orgId: string;
  endpointId: string;
  event: string;
  payload: string;
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: Date | null;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** TTL: delivery logs expire (Date, not number). */
  expireAt: Date;
}

export interface Suppression {
  email: string;
  reason: "unsubscribe" | "bounce" | "complaint" | "manual";
  scope: string; // "all" or a list/category id
  at: Date;
}

/** A reviewer's verdict on one job. Collection `labels`, one row per job (latest wins). Feeds ml/agency training. */
export interface LabelDoc {
  jobId: string;
  label: "agency" | "direct";
  input: ClassifyInput;
  by: string;
  at: Date;
}

/** One self-serve or admin refund per Stripe customer. Collection `refunds`, keyed by customer id. */
export interface RefundRecord {
  customerId: string;
  orgId: string;
  chargeId: string;
  amount: number;
  by: "self" | "admin";
  at: Date;
}

export interface Db {
  readonly app: string;

  // billing
  getBillingAccount(orgId: string): Promise<BillingAccount | null>;
  upsertBillingAccount(a: Omit<BillingAccount, "app" | "createdAt"> & { createdAt?: Date }): Promise<void>;
  findBillingAccountByCustomer(customerId: string): Promise<BillingAccount | null>;
  getEntitlement(orgId: string): Promise<Entitlement | null>;
  setEntitlement(orgId: string, e: Entitlement): Promise<void>;
  /** Webhook idempotency: was this event already processed successfully? */
  hasStripeEvent(id: string): Promise<boolean>;
  /** Record AFTER successful processing (fix for BACKEND_REUSE 2.2 #4). Returns false if already recorded. */
  markStripeEvent(id: string, type: string): Promise<boolean>;

  // metering
  incUsage(orgId: string, meter: string, period: string, by?: number): Promise<number>;
  getUsage(orgId: string, meter: string, period: string): Promise<number>;

  // rate limiting (sliding window). Returns hits inside the window INCLUDING this one.
  hitRateLimit(key: string, windowMs: number, now?: number): Promise<number>;

  // audit log (append-only)
  appendAudit(e: Omit<AuditEntry, "id" | "app" | "at"> & { at?: Date }): Promise<AuditEntry>;
  listAudit(orgId: string, opts?: { limit?: number; before?: Date }): Promise<AuditEntry[]>;

  // outbound webhooks
  createWebhookEndpoint(e: Omit<WebhookEndpoint, "app" | "createdAt">): Promise<WebhookEndpoint>;
  listWebhookEndpoints(orgId: string): Promise<WebhookEndpoint[]>;
  getWebhookEndpoint(orgId: string, id: string): Promise<WebhookEndpoint | null>;
  updateWebhookEndpoint(orgId: string, id: string, patch: Partial<Pick<WebhookEndpoint, "url" | "events" | "enabled">>): Promise<void>;
  deleteWebhookEndpoint(orgId: string, id: string): Promise<void>;
  createDelivery(d: Omit<WebhookDelivery, "app">): Promise<void>;
  updateDelivery(id: string, patch: Partial<Omit<WebhookDelivery, "id" | "app" | "orgId">>): Promise<void>;
  listDeliveries(orgId: string, opts?: { endpointId?: string; limit?: number }): Promise<WebhookDelivery[]>;
  getDelivery(orgId: string, id: string): Promise<WebhookDelivery | null>;
  dueDeliveries(now: Date, limit: number): Promise<WebhookDelivery[]>;

  /** Lifetime cap: atomic counter plus one claim per org (re-claiming is free). `sold` is the count after the call. */
  claimLifetime(orgId: string, cap: number): Promise<{ ok: boolean; sold: number }>;
  /** Gives the org's claimed slot back (abandoned checkout, full refund). No-op when it holds none. */
  releaseLifetime(orgId: string): Promise<void>;
  lifetimeSold(): Promise<number>;
  /** Insert only. False when this customer already had a refund (the once only rule). */
  reserveRefund(r: RefundRecord): Promise<boolean>;
  releaseRefund(customerId: string): Promise<void>;
  getRefund(customerId: string): Promise<RefundRecord | null>;
  /** Paid, non lifetime plans (for renewal reminders). */
  listEntitlements(): Promise<{ orgId: string; entitlement: Entitlement }[]>;
  /** Insert only: true the first time a key is seen (reminder dedupe). */
  markReminder(key: string): Promise<boolean>;
  setSuspended(orgId: string, suspended: boolean, by: string): Promise<void>;
  isSuspended(orgId: string): Promise<boolean>;

  // agency review (admin)
  /** Upsert by job id. */
  addLabel(l: LabelDoc): Promise<void>;
  listLabels(limit?: number): Promise<LabelDoc[]>;
  /** Open jobs whose classification is still `pending`, newest first. */
  listPendingAgency(limit: number): Promise<JobDoc[]>;
  setJobAgency(id: string, flag: AgencyFlag, score: number): Promise<void>;

  // mail suppression list
  addSuppression(s: Omit<Suppression, "at"> & { at?: Date }): Promise<void>;
  isSuppressed(email: string, scope?: string): Promise<boolean>;
  removeSuppression(email: string, scope?: string): Promise<void>;

  // remote flags
  getConfig(): Promise<Record<string, string>>;
  setConfig(key: string, value: string): Promise<void>;

  // job database (M2). employers = the source list; crawl_leases = shard claims; source_runs = crawl health.
  /** Insert only: an existing row keeps its crawl state. Returns true when created. */
  upsertEmployer(e: EmployerSeed, now: Date, seed?: boolean): Promise<boolean>;
  getEmployer(id: string): Promise<EmployerDoc | null>;
  listEmployers(): Promise<EmployerDoc[]>;
  dueEmployers(now: Date, limit: number): Promise<EmployerDoc[]>;
  patchEmployer(id: string, patch: Partial<Omit<EmployerDoc, "id">>): Promise<void>;
  /** Atomic claim of one key. False if another owner holds an unexpired lease. */
  tryLease(key: string, owner: string, now: Date, ttlMs: number): Promise<boolean>;
  releaseLease(key: string, owner: string): Promise<void>;
  /** Idempotent by job id. New rows get firstSeenAt = now; seen rows are reopened and miss count reset. */
  upsertJobs(jobs: JobUpsert[], now: Date): Promise<{ inserted: number; updated: number }>;
  /** Jobs of an employer not in `seenExternalIds` get a miss; at `threshold` misses they close. Returns closed count. */
  closeMissing(employerId: string, seenExternalIds: string[], now: Date, threshold?: number): Promise<number>;
  closeByExternalIds(employerId: string, externalIds: string[], now: Date): Promise<number>;
  jobsByDedupeKeys(keys: string[]): Promise<{ id: string; dedupeKey: string; firstSeenAt: Date }[]>;
  getJob(id: string): Promise<JobDoc | null>;
  getJobs(ids: string[]): Promise<JobDoc[]>;
  queryJobs(q: JobQuery): Promise<JobDoc[]>;
  countJobs(q: JobQuery): Promise<number>;
  /** Open jobs hidden because they are flagged as staffing agency posts. */
  countAgencyHidden(q: JobQuery): Promise<number>;
  recordSourceRun(r: SourceRun): Promise<void>;
  listSourceRuns(limit: number): Promise<SourceRun[]>;
  /** One open per (org, day, job). True when this is the first open of that job that day. */
  recordOpen(orgId: string, day: string, jobId: string): Promise<boolean>;
  hasOpened(orgId: string, day: string, jobId: string): Promise<boolean>;
  /** True when newly saved. */
  saveJob(orgId: string, jobId: string, now: Date): Promise<boolean>;
  unsaveJob(orgId: string, jobId: string): Promise<boolean>;
  listSaved(orgId: string): Promise<SavedJob[]>;
  getProfile(orgId: string): Promise<SearchProfile | null>;
  saveProfile(p: SearchProfile): Promise<void>;
  listProfiles(filter: { digest?: boolean; alerts?: boolean }): Promise<SearchProfile[]>;

  // privacy
  exportOrgData(orgId: string): Promise<Record<string, unknown>>;
  deleteOrgData(orgId: string): Promise<void>;
}

export const DELIVERY_TTL_DAYS = 90;
