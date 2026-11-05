// The one app-data interface (ported from trayo server/db/Db.ts; sync/family/anonymous removed).
// Users, sessions, orgs, members and API keys belong to Better Auth (its own adapter, same database).
// Billing is per organization ("subject" = org id). Every document carries `app` so a shared cluster stays safe.
// TTL fields are BSON Dates (the apps stored numbers, so Mongo TTL never fired: BACKEND_REUSE 1.5).

import type { PlanId } from "@/config/product";

export type EntitlementStatus = "none" | "trialing" | "active" | "past_due" | "canceled" | "lifetime";

export interface Entitlement {
  /** Paid plan is live (trialing/active/past_due within grace, or lifetime). */
  isPaid: boolean;
  status: EntitlementStatus;
  plan: PlanId;
  interval: "month" | "year" | null;
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

  // mail suppression list
  addSuppression(s: Omit<Suppression, "at"> & { at?: Date }): Promise<void>;
  isSuppressed(email: string, scope?: string): Promise<boolean>;
  removeSuppression(email: string, scope?: string): Promise<void>;

  // remote flags
  getConfig(): Promise<Record<string, string>>;
  setConfig(key: string, value: string): Promise<void>;

  // privacy
  exportOrgData(orgId: string): Promise<Record<string, unknown>>;
  deleteOrgData(orgId: string): Promise<void>;
}

export const DELIVERY_TTL_DAYS = 90;
