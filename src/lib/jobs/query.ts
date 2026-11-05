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
  if (q.locationTerms?.length) {
    const place = `${j.location ?? ""} ${j.region ?? ""}`.toLowerCase();
    if (!q.locationTerms.some((t) => place.includes(t.toLowerCase()))) return false;
  }
  return true;
}

export function mongoFilter(q: JobQuery, app: string): Record<string, unknown> {
  const f: Record<string, unknown> = { app, closedAt: null };
  if (!q.includeAgency) f.agencyFlag = { $ne: "yes" };
  if (q.field) f.field = q.field;
  if (q.country) f.country = q.country;
  if (q.remoteTypes) f.remoteType = { $in: q.remoteTypes };
  const and: Record<string, unknown>[] = [];
  if (q.payFloor) and.push({ $or: [{ payHourlyMax: null }, { payHourlyMax: { $gte: q.payFloor } }] });
  if (q.locationTerms?.length) {
    const re = new RegExp(q.locationTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
    and.push({ $or: [{ location: { $regex: re } }, { region: { $regex: re } }] });
  }
  if (and.length) f.$and = and;
  if (q.levels) f.level = { $in: q.levels };
  if (q.schedule) f.schedule = q.schedule;
  if (q.firstSeenAfter) f.firstSeenAt = { $gt: q.firstSeenAfter };
  return f;
}

/** Newest first. */
export const byNewest = (a: JobDoc, b: JobDoc) => b.postedAt.getTime() - a.postedAt.getTime() || a.id.localeCompare(b.id);
