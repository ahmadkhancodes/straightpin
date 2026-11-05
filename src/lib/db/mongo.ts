import { MongoClient, type Collection, type Db as MongoDatabase, type Document } from "mongodb";
import { uuidv7 } from "@/lib/ids";
import { DELIVERY_TTL_DAYS, type AuditEntry, type BillingAccount, type Db, type Entitlement, type Suppression, type WebhookDelivery, type WebhookEndpoint } from "./types";

// Ported from trayo server/db/mongo.ts. Changes: global singleton client (Vercel), pool 10, Date TTLs,
// stripe events recorded after success, no sync/family/anonymous. Use only from runtime = "nodejs" routes.

declare global {
  var __kitMongo: { uri: string; client: Promise<MongoClient> } | undefined;
}

export function mongoClient(uri: string): Promise<MongoClient> {
  if (globalThis.__kitMongo?.uri === uri) return globalThis.__kitMongo.client;
  const client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000, appName: "buffersol-kit" }).connect();
  globalThis.__kitMongo = { uri, client };
  client.catch(() => {
    if (globalThis.__kitMongo?.client === client) globalThis.__kitMongo = undefined;
  });
  return client;
}

type WithId<T> = T & { _id: string };

export function createMongoDb(uri: string, dbName: string, app: string): Db {
  let dbp: Promise<MongoDatabase> | null = null;
  const db = () => (dbp ??= mongoClient(uri).then((c) => c.db(dbName)));
  const col = async <T extends Document>(name: string) => (await db()).collection<T>(name) as unknown as Collection<T>;
  const strip = <T>(d: (T & { _id?: unknown; app?: string }) | null): T | null => {
    if (!d) return null;
    const { _id: _i, ...rest } = d as Record<string, unknown>;
    return rest as T;
  };

  return {
    app,
    async getBillingAccount(id) {
      return strip<BillingAccount>(await (await col<WithId<BillingAccount>>("billing_accounts")).findOne({ _id: id, app }));
    },
    async upsertBillingAccount(a) {
      const { createdAt, ...rest } = a;
      await (await col<WithId<BillingAccount>>("billing_accounts")).updateOne(
        { _id: a.id },
        { $set: { ...rest, app }, $setOnInsert: { createdAt: createdAt ?? new Date() } },
        { upsert: true },
      );
    },
    async findBillingAccountByCustomer(c) {
      return strip<BillingAccount>(await (await col<WithId<BillingAccount>>("billing_accounts")).findOne({ app, stripeCustomerId: c }));
    },
    async getEntitlement(id) {
      const d = await (await col<WithId<Entitlement & { app: string }>>("entitlements")).findOne({ _id: id, app });
      if (!d) return null;
      const { _id: _i, app: _a, ...rest } = d;
      return rest as Entitlement;
    },
    async setEntitlement(id, e) {
      await (await col<WithId<Entitlement & { app: string }>>("entitlements")).replaceOne({ _id: id }, { ...e, app }, { upsert: true });
    },
    async hasStripeEvent(id) {
      return !!(await (await col<{ _id: string }>("stripe_events")).findOne({ _id: id }, { projection: { _id: 1 } }));
    },
    async markStripeEvent(id, type) {
      try {
        // expireAt (Date) lets Mongo TTL drop rows after Stripe's 30 day retry horizon.
        await (await col<{ _id: string; app: string; type: string; at: Date; expireAt: Date }>("stripe_events")).insertOne({
          _id: id, app, type, at: new Date(), expireAt: new Date(Date.now() + 35 * 864e5),
        });
        return true;
      } catch (e) {
        if ((e as { code?: number }).code === 11000) return false;
        throw e;
      }
    },
    async incUsage(orgId, meter, period, by = 1) {
      const r = await (await col<{ _id: string; app: string; orgId: string; meter: string; period: string; value: number }>("usage")).findOneAndUpdate(
        { _id: `${orgId}|${meter}|${period}` },
        { $inc: { value: by }, $setOnInsert: { app, orgId, meter, period } },
        { upsert: true, returnDocument: "after" },
      );
      return r?.value ?? by;
    },
    async getUsage(orgId, meter, period) {
      const d = await (await col<{ _id: string; value: number }>("usage")).findOne({ _id: `${orgId}|${meter}|${period}` });
      return d?.value ?? 0;
    },
    async hitRateLimit(key, windowMs, now = Date.now()) {
      // One atomic pipeline update: drop hits outside the window, push this one, bump the TTL Date.
      const r = await (await col<{ _id: string; hits: number[]; expireAt: Date }>("rate_limits")).findOneAndUpdate(
        { _id: `${app}:${key}` },
        [
          {
            $set: {
              hits: {
                $concatArrays: [
                  { $filter: { input: { $ifNull: ["$hits", []] }, as: "h", cond: { $gt: ["$$h", now - windowMs] } } },
                  [now],
                ],
              },
              expireAt: new Date(now + windowMs),
            },
          },
        ],
        { upsert: true, returnDocument: "after" },
      );
      return r?.hits.length ?? 1;
    },
    async appendAudit(e) {
      const entry: AuditEntry = { ...e, id: uuidv7(), app, at: e.at ?? new Date() };
      await (await col<WithId<AuditEntry>>("audit_log")).insertOne({ _id: entry.id, ...entry });
      return entry;
    },
    async listAudit(orgId, { limit = 50, before } = {}) {
      const docs = await (await col<WithId<AuditEntry>>("audit_log"))
        .find({ app, orgId, ...(before ? { at: { $lt: before } } : {}) })
        .sort({ at: -1 })
        .limit(Math.min(limit, 200))
        .toArray();
      return docs.map((d) => strip<AuditEntry>(d)!);
    },
    async createWebhookEndpoint(e) {
      const ep: WebhookEndpoint = { ...e, app, createdAt: new Date() };
      await (await col<WithId<WebhookEndpoint>>("webhook_endpoints")).insertOne({ _id: ep.id, ...ep });
      return ep;
    },
    async listWebhookEndpoints(orgId) {
      const docs = await (await col<WithId<WebhookEndpoint>>("webhook_endpoints")).find({ app, orgId }).sort({ createdAt: 1 }).toArray();
      return docs.map((d) => strip<WebhookEndpoint>(d)!);
    },
    async getWebhookEndpoint(orgId, id) {
      return strip<WebhookEndpoint>(await (await col<WithId<WebhookEndpoint>>("webhook_endpoints")).findOne({ _id: id, orgId, app }));
    },
    async updateWebhookEndpoint(orgId, id, patch) {
      await (await col<WithId<WebhookEndpoint>>("webhook_endpoints")).updateOne({ _id: id, orgId, app }, { $set: patch });
    },
    async deleteWebhookEndpoint(orgId, id) {
      await (await col<WithId<WebhookEndpoint>>("webhook_endpoints")).deleteOne({ _id: id, orgId, app });
    },
    async createDelivery(d) {
      await (await col<WithId<WebhookDelivery>>("webhook_deliveries")).insertOne({ _id: d.id, ...d, app });
    },
    async updateDelivery(id, patch) {
      await (await col<WithId<WebhookDelivery>>("webhook_deliveries")).updateOne({ _id: id, app }, { $set: patch });
    },
    async listDeliveries(orgId, { endpointId, limit = 50 } = {}) {
      const docs = await (await col<WithId<WebhookDelivery>>("webhook_deliveries"))
        .find({ app, orgId, ...(endpointId ? { endpointId } : {}) })
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 200))
        .toArray();
      return docs.map((d) => strip<WebhookDelivery>(d)!);
    },
    async getDelivery(orgId, id) {
      return strip<WebhookDelivery>(await (await col<WithId<WebhookDelivery>>("webhook_deliveries")).findOne({ _id: id, orgId, app }));
    },
    async dueDeliveries(now, limit) {
      const docs = await (await col<WithId<WebhookDelivery>>("webhook_deliveries"))
        .find({ app, status: { $in: ["pending", "retrying"] }, nextAttemptAt: { $lte: now } })
        .sort({ nextAttemptAt: 1 })
        .limit(limit)
        .toArray();
      return docs.map((d) => strip<WebhookDelivery>(d)!);
    },
    async addSuppression(s) {
      const email = s.email.toLowerCase();
      await (await col<WithId<Suppression & { app: string }>>("suppressions")).updateOne(
        { _id: `${app}:${email}|${s.scope}` },
        { $set: { email, reason: s.reason, scope: s.scope, at: s.at ?? new Date(), app } },
        { upsert: true },
      );
    },
    async isSuppressed(email, scope = "all") {
      const e = email.toLowerCase();
      return !!(await (await col<{ _id: string }>("suppressions")).findOne({ _id: { $in: [`${app}:${e}|all`, `${app}:${e}|${scope}`] } }));
    },
    async removeSuppression(email, scope = "all") {
      await (await col<{ _id: string }>("suppressions")).deleteOne({ _id: `${app}:${email.toLowerCase()}|${scope}` });
    },
    async getConfig() {
      const docs = await (await col<{ _id: string; value: string; app: string }>("config")).find({ app }).toArray();
      return Object.fromEntries(docs.map((d) => [d._id.replace(`${app}:`, ""), d.value]));
    },
    async setConfig(k, v) {
      await (await col<{ _id: string; value: string; app: string }>("config")).updateOne({ _id: `${app}:${k}` }, { $set: { value: v, app } }, { upsert: true });
    },
    async exportOrgData(orgId) {
      const [billingAccount, entitlement, endpoints, auditLog] = await Promise.all([
        this.getBillingAccount(orgId),
        this.getEntitlement(orgId),
        this.listWebhookEndpoints(orgId),
        this.listAudit(orgId, { limit: 200 }),
      ]);
      return { billingAccount, entitlement, webhookEndpoints: endpoints.map(({ secret: _s, ...rest }) => rest), auditLog };
    },
    async deleteOrgData(orgId) {
      const d = await db();
      await d.collection("billing_accounts").deleteOne({ _id: orgId as never });
      await d.collection("entitlements").deleteOne({ _id: orgId as never });
      await d.collection("usage").deleteMany({ app, orgId });
      await d.collection("webhook_endpoints").deleteMany({ app, orgId });
      await d.collection("webhook_deliveries").deleteMany({ app, orgId });
    },
  };
}

/** Indexes, created once by scripts/ensure-indexes.ts (never per cold start). TTLs are on Date fields. */
export async function ensureIndexes(uri: string, dbName: string) {
  const d = (await mongoClient(uri)).db(dbName);
  await d.collection("billing_accounts").createIndex({ app: 1, stripeCustomerId: 1 }, { unique: true, partialFilterExpression: { stripeCustomerId: { $type: "string" } } });
  await d.collection("stripe_events").createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("rate_limits").createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("usage").createIndex({ app: 1, orgId: 1, period: 1 });
  await d.collection("audit_log").createIndex({ app: 1, orgId: 1, at: -1 });
  await d.collection("webhook_endpoints").createIndex({ app: 1, orgId: 1 });
  await d.collection("webhook_deliveries").createIndex({ app: 1, orgId: 1, createdAt: -1 });
  await d.collection("webhook_deliveries").createIndex({ app: 1, status: 1, nextAttemptAt: 1 });
  await d.collection("webhook_deliveries").createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("suppressions").createIndex({ app: 1, email: 1 });
  // Better Auth collections
  await d.collection("user").createIndex({ email: 1 }, { unique: true });
  await d.collection("session").createIndex({ token: 1 }, { unique: true });
  await d.collection("session").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("verification").createIndex({ identifier: 1 });
  await d.collection("verification").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await d.collection("member").createIndex({ organizationId: 1, userId: 1 }, { unique: true });
  await d.collection("organization").createIndex({ slug: 1 }, { unique: true });
  await d.collection("apikey").createIndex({ key: 1 });
  return DELIVERY_TTL_DAYS;
}
