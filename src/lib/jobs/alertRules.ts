import { effectivePlan } from "@/lib/billing/entitlement";
import type { Country } from "@/lib/crawl/types";
import type { Db } from "@/lib/db/types";
import { safeEqual, uuidv7 } from "@/lib/ids";
import { manageToken } from "@/lib/mail";
import { isFieldId } from "./fields";
import type { AlertRule } from "./types";

export type { AlertRule };

export const MAX_LOCATION_CHARS = 60;
export const MAX_PAY_FLOOR = 500;
const COUNTRIES: Country[] = ["US", "CA", "UK"];

export interface AlertInput { field: unknown; country: unknown; location?: unknown; payFloor?: unknown }

/** Pure: validate a form or JSON body. Returns the cleaned fields or the first problem, in plain words. */
export function parseAlertInput(i: AlertInput): { ok: true; value: Pick<AlertRule, "field" | "country" | "location" | "payFloor"> } | { ok: false; error: string } {
  if (!isFieldId(i.field)) return { ok: false, error: "Pick one of the fields." };
  if (!COUNTRIES.includes(i.country as Country)) return { ok: false, error: "Pick the United States, Canada or the United Kingdom." };
  const location = String(i.location ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LOCATION_CHARS);
  const pay = i.payFloor === undefined || i.payFloor === "" || i.payFloor === null ? 0 : Number(i.payFloor);
  if (!Number.isFinite(pay) || pay < 0 || pay > MAX_PAY_FLOOR) return { ok: false, error: `Pay floor is an hourly figure from 0 to ${MAX_PAY_FLOOR}.` };
  return { ok: true, value: { field: i.field, country: i.country as Country, location, payFloor: Math.round(pay * 100) / 100 } };
}

/** The plan's alert allowance for this org, from its entitlement. */
export async function alertLimitFor(db: Db, orgId: string, now: Date): Promise<number> {
  return effectivePlan(await db.getEntitlement(orgId), now.getTime()).alertLimit;
}

export type AddResult = { ok: true; rule: AlertRule } | { ok: false; error: "limit" | "invalid"; message: string; limit?: number };

/** Save one more alert unless the plan's number is used up. Free plans have 0 (they get the daily digest). */
export async function addAlertRule(db: Db, ctx: { orgId: string; email: string }, input: AlertInput, now: Date): Promise<AddResult> {
  const parsed = parseAlertInput(input);
  if (!parsed.ok) return { ok: false, error: "invalid", message: parsed.error };
  const limit = await alertLimitFor(db, ctx.orgId, now);
  const have = (await db.listAlertRules(ctx.orgId)).length;
  if (have >= limit) {
    return { ok: false, error: "limit", limit, message: limit === 0 ? "Instant alerts are on paid plans. Free plans get the daily digest." : `Your plan keeps ${limit} alerts and you have ${have}. Delete one to add another.` };
  }
  const rule: AlertRule = { id: uuidv7(), orgId: ctx.orgId, email: ctx.email.toLowerCase(), ...parsed.value, active: true, createdAt: now, lastSentAt: null };
  await db.saveAlertRule(rule);
  return { ok: true, rule };
}

/** The rules the cron may send: within the plan's number, oldest first. A downgrade keeps the oldest rules working. */
export function withinLimit(rules: AlertRule[], limit: number): AlertRule[] {
  return rules.slice(0, Math.max(0, limit));
}

export async function verifyManageToken(email: string, token: string): Promise<boolean> {
  return !!email && !!token && safeEqual(token, await manageToken(email));
}

export function ruleLabel(r: Pick<AlertRule, "country" | "location" | "payFloor">, fieldName: string): string {
  return [fieldName, r.location ? `${r.location}, ${r.country}` : r.country, r.payFloor ? `$${r.payFloor}+/hr` : null].filter(Boolean).join(" · ");
}
