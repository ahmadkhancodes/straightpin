import { periodFor, meter, usageState, type UsageState } from "@/lib/billing/usage";
import { effectivePlan } from "@/lib/billing/entitlement";
import type { Db } from "@/lib/db/types";

export type OpenResult = { ok: true; repeat: boolean; state: UsageState } | { ok: false; state: UsageState };

/**
 * Consume one daily open for (org, job). Re-opening the same job the same UTC day is free.
 * Over the limit: the counter is rolled back and nothing is recorded, so the number shown stays truthful.
 */
export async function consumeOpen(db: Db, orgId: string, jobId: string, now = new Date()): Promise<OpenResult> {
  const day = periodFor("opens", now);
  if (await db.hasOpened(orgId, day, jobId)) {
    const ent = await db.getEntitlement(orgId);
    return { ok: true, repeat: true, state: usageState("opens", await db.getUsage(orgId, "opens", day), effectivePlan(ent, now.getTime()).limits.opens) };
  }
  const m = await meter(db, orgId, "opens", 1, now);
  if (!m.within) {
    await db.incUsage(orgId, "opens", day, -1);
    return { ok: false, state: usageState("opens", m.used - 1, m.limit) };
  }
  if (!(await db.recordOpen(orgId, day, jobId))) {
    // Lost a race with a parallel request for the same job: that request already paid.
    await db.incUsage(orgId, "opens", day, -1);
    return { ok: true, repeat: true, state: usageState("opens", m.used - 1, m.limit) };
  }
  return { ok: true, repeat: false, state: m };
}

export type SaveResult = { ok: true; created: boolean; state: UsageState } | { ok: false; state: UsageState };

/** Save a job. Counts against the running `saves` meter only when newly saved; over the limit rolls back. */
export async function saveJobFor(db: Db, orgId: string, jobId: string, now = new Date()): Promise<SaveResult> {
  const ent = await db.getEntitlement(orgId);
  const limit = effectivePlan(ent, now.getTime()).limits.saves;
  const used = await db.getUsage(orgId, "saves", "all");
  if (!(await db.saveJob(orgId, jobId, now))) return { ok: true, created: false, state: usageState("saves", used, limit) };
  const m = await meter(db, orgId, "saves", 1, now);
  if (!m.within) {
    await db.unsaveJob(orgId, jobId);
    await db.incUsage(orgId, "saves", "all", -1);
    return { ok: false, state: usageState("saves", m.used - 1, m.limit) };
  }
  return { ok: true, created: true, state: m };
}

export async function unsaveJobFor(db: Db, orgId: string, jobId: string): Promise<boolean> {
  const removed = await db.unsaveJob(orgId, jobId);
  if (removed) await db.incUsage(orgId, "saves", "all", -1);
  return removed;
}
