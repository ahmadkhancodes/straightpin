import type { MeterId } from "@/config/product";
import type { Db } from "@/lib/db/types";
import { effectivePlan, limitFor } from "./entitlement";

// Metering: opens reset every UTC day, saves are a running total ("all"). periodOf stays the monthly helper.
export const periodOf = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
export const periodFor = (m: MeterId, d = new Date()) => (m === "opens" ? d.toISOString().slice(0, 10) : "all");

export interface UsageState {
  meter: MeterId;
  used: number;
  limit: number;
  ratio: number;
  /** "ok" < 80%, "near" 80-99%, "over" >= 100% */
  level: "ok" | "near" | "over";
}

export function usageState(meter: MeterId, used: number, limit: number): UsageState {
  const ratio = limit <= 0 ? (used > 0 ? 1 : 0) : used / limit;
  return { meter, used, limit, ratio, level: ratio >= 1 ? "over" : ratio >= 0.8 ? "near" : "ok" };
}

/** Count one unit and report whether it is within the plan (soft cap: caller decides to hold, never drop). */
export async function meter(db: Db, orgId: string, m: MeterId, by = 1, now = new Date()): Promise<UsageState & { within: boolean }> {
  const ent = await db.getEntitlement(orgId);
  const used = await db.incUsage(orgId, m, periodFor(m, now), by);
  const limit = limitFor(ent, m, now.getTime());
  return { ...usageState(m, used, limit), within: used <= limit };
}

export async function currentUsage(db: Db, orgId: string, meters: MeterId[], now = new Date()): Promise<UsageState[]> {
  const ent = await db.getEntitlement(orgId);
  const plan = effectivePlan(ent, now.getTime());
  return Promise.all(meters.map(async (m) => usageState(m, await db.getUsage(orgId, m, periodFor(m, now)), plan.limits[m])));
}
