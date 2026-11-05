import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/types";
import { HttpError } from "@/lib/http";

// Mongo sliding-window rate limiter (new code: neither app had one; BACKEND_REUSE 1.9).
export interface Rule { limit: number; windowMs: number }

export const RULES = {
  authIp: { limit: 20, windowMs: 10 * 60_000 },
  authEmail: { limit: 5, windowMs: 10 * 60_000 },
  billing: { limit: 10, windowMs: 60_000 },
  account: { limit: 5, windowMs: 60 * 60_000 },
  publicForm: { limit: 30, windowMs: 60_000 },
  api: { limit: 600, windowMs: 60_000 },
} satisfies Record<string, Rule>;

export async function rateLimit(key: string, rule: Rule, db?: Db, now = Date.now()) {
  const d = db ?? (await getDb());
  const hits = await d.hitRateLimit(key, rule.windowMs, now);
  return { ok: hits <= rule.limit, remaining: Math.max(0, rule.limit - hits), resetMs: rule.windowMs };
}

/** Throws 429 rate_limited when over. */
export async function enforceRateLimit(key: string, rule: Rule, db?: Db) {
  const r = await rateLimit(key, rule, db);
  if (!r.ok) throw new HttpError(429, "rate_limited", { retryAfterSeconds: Math.ceil(rule.windowMs / 1000) });
  return r;
}
