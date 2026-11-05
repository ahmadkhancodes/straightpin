import type { JobDoc, JobQuery } from "./types";

/** One definition of "which jobs match", used by the memory driver and turned into a Mongo filter. */
export function matchesQuery(j: JobDoc, q: JobQuery): boolean {
  if (j.closedAt) return false;
  if (!q.includeAgency && j.agencyFlag === "yes") return false;
  if (q.field && j.field !== q.field) return false;
  if (q.country && j.country !== q.country) return false;
  if (q.remoteTypes && !q.remoteTypes.includes(j.remoteType)) return false;
  if (q.payFloor && j.payHourlyMax !== null && j.payHourlyMax < q.payFloor) return false;
  if (q.levels && !q.levels.includes(j.level)) return false;
  if (q.schedule && j.schedule !== q.schedule) return false;
  if (q.firstSeenAfter && j.firstSeenAt <= q.firstSeenAfter) return false;
  return true;
}

export function mongoFilter(q: JobQuery, app: string): Record<string, unknown> {
  const f: Record<string, unknown> = { app, closedAt: null };
  if (!q.includeAgency) f.agencyFlag = { $ne: "yes" };
  if (q.field) f.field = q.field;
  if (q.country) f.country = q.country;
  if (q.remoteTypes) f.remoteType = { $in: q.remoteTypes };
  if (q.payFloor) f.$or = [{ payHourlyMax: null }, { payHourlyMax: { $gte: q.payFloor } }];
  if (q.levels) f.level = { $in: q.levels };
  if (q.schedule) f.schedule = q.schedule;
  if (q.firstSeenAfter) f.firstSeenAt = { $gt: q.firstSeenAfter };
  return f;
}

/** Newest first. */
export const byNewest = (a: JobDoc, b: JobDoc) => b.postedAt.getTime() - a.postedAt.getTime() || a.id.localeCompare(b.id);
