import { z } from "zod";
import type { Db } from "@/lib/db/types";
import { FIELDS, type FieldId } from "./fields";
import type { JobDoc, JobQuery, Level, SearchProfile } from "./types";

/** The 6 quiz questions, in order. Single source for the UI, the API and the query builder. */
export const quizSchema = z.object({
  field: z.enum(FIELDS.map((f) => f.id) as [FieldId, ...FieldId[]]),
  country: z.enum(["US", "CA", "UK"]),
  remote: z.enum(["remote", "remote_hybrid", "any"]),
  payFloor: z.coerce.number().int().min(0).max(100),
  level: z.enum(["entry", "mid", "senior", "any"]),
  schedule: z.enum(["full", "part", "any"]),
});
export type QuizAnswers = z.infer<typeof quizSchema>;

export const QUIZ_STEPS = [
  { key: "field", title: "What kind of work are you looking for?", options: FIELDS.map((f) => ({ value: f.id as string, label: f.label })) },
  { key: "country", title: "Where do you want to work?", options: [{ value: "US", label: "United States" }, { value: "CA", label: "Canada" }, { value: "UK", label: "United Kingdom" }] },
  { key: "remote", title: "Where should the work happen?", options: [{ value: "remote", label: "Remote only" }, { value: "remote_hybrid", label: "Remote or hybrid" }, { value: "any", label: "Anywhere, on site is fine" }] },
  { key: "payFloor", title: "What is the lowest pay you would take?", options: [{ value: "0", label: "Any pay" }, { value: "15", label: "$15 an hour or more" }, { value: "20", label: "$20 an hour or more" }, { value: "25", label: "$25 an hour or more" }, { value: "35", label: "$35 an hour or more" }] },
  { key: "level", title: "How much experience do you have?", options: [{ value: "entry", label: "Just starting out" }, { value: "mid", label: "A few years" }, { value: "senior", label: "Senior or lead" }, { value: "any", label: "Show every level" }] },
  { key: "schedule", title: "Full time or part time?", options: [{ value: "full", label: "Full time" }, { value: "part", label: "Part time" }, { value: "any", label: "Either" }] },
] as const;

const LEVELS: Record<Exclude<QuizAnswers["level"], "any">, Level[]> = { entry: ["entry", "mid"], mid: ["entry", "mid", "senior"], senior: ["mid", "senior"] };

/** Answers (possibly partial, for the live count mid quiz) to a database query. Only answered questions filter. */
export function queryFromAnswers(a: Partial<QuizAnswers>): JobQuery {
  const q: JobQuery = {};
  if (a.field) q.field = a.field;
  if (a.country) q.country = a.country;
  if (a.remote === "remote") q.remoteTypes = ["remote"];
  else if (a.remote === "remote_hybrid") q.remoteTypes = ["remote", "hybrid"];
  if (a.payFloor) q.payFloor = a.payFloor;
  if (a.level && a.level !== "any") q.levels = LEVELS[a.level];
  if (a.schedule && a.schedule !== "any") q.schedule = a.schedule;
  return q;
}

export const answersFromProfile = (p: SearchProfile): QuizAnswers => ({ field: p.field, country: p.country, remote: p.remote, payFloor: p.payFloor, level: p.level, schedule: p.schedule });

/** Parse URL search params (or a form) into answers; undefined when incomplete or invalid. */
export function parseAnswers(get: (k: string) => string | null | undefined): QuizAnswers | undefined {
  const r = quizSchema.safeParse(Object.fromEntries(QUIZ_STEPS.map((s) => [s.key, get(s.key) ?? undefined])));
  return r.success ? r.data : undefined;
}
/** The leading answers that are present and valid, for the live count on each quiz screen. */
export function partialAnswers(get: (k: string) => string | null | undefined): Partial<QuizAnswers> {
  const out: Record<string, unknown> = {};
  for (const s of QUIZ_STEPS) {
    const v = get(s.key);
    if (v === null || v === undefined || !s.options.some((o) => o.value === v)) break;
    out[s.key] = s.key === "payFloor" ? Number(v) : v;
  }
  return out as Partial<QuizAnswers>;
}

const DAY = 86_400_000;
const money = (j: JobDoc) => (j.payHourlyMax === null ? null : `pays up to $${Math.round(j.payHourlyMax)} an hour`);

/** Deterministic match score 0 to 100 with a one line reason. Same input, same order. */
export function matchScore(j: JobDoc, a: QuizAnswers, now: Date): { score: number; reason: string } {
  let s = 60;
  const why: string[] = [];
  if (j.remoteType === "remote") { s += a.remote === "any" ? 4 : 12; why.push("Remote"); }
  else if (j.remoteType === "hybrid" && a.remote !== "remote") { s += 6; why.push("Hybrid"); }
  if (j.payHourlyMax !== null) {
    if (a.payFloor > 0 && j.payHourlyMax >= a.payFloor) { s += 10; why.push(money(j)!); }
    else if (a.payFloor === 0) { s += 4; why.push(money(j)!); }
  }
  if (a.level !== "any" && j.level === a.level) { s += 8; why.push("fits your experience"); }
  if (a.schedule !== "any" && j.schedule === a.schedule) { s += 4; }
  // Only the company's own date counts: a job with no published date is never called "posted today".
  const age = j.firstPublishedAt ? Math.floor((now.getTime() - j.firstPublishedAt.getTime()) / DAY) : Infinity;
  if (age <= 7) { s += 6; why.push(age <= 0 ? "posted today" : `posted ${age} ${age === 1 ? "day" : "days"} ago`); }
  s -= Math.round(j.ghostScore * 20);
  const score = Math.max(0, Math.min(100, s));
  const line = why.length ? why.join(", ") : "Matches your field and place";
  return { score, reason: line.charAt(0).toUpperCase() + line.slice(1) };
}

export function rankJobs(jobs: JobDoc[], a: QuizAnswers, now: Date) {
  return jobs
    .map((job) => ({ job, ...matchScore(job, a, now) }))
    .sort((x, y) => y.score - x.score || y.job.postedAt.getTime() - x.job.postedAt.getTime() || x.job.id.localeCompare(y.job.id));
}

// Live count: indexed Mongo count behind a 60 s per instance cache (ARCHITECTURE section 2: matching, quiz counts).
const COUNT_TTL_MS = 60_000;
declare global {
  var __straightpinCounts: Map<string, { at: number; value: { count: number; agencyHidden: number } }> | undefined;
}
// On globalThis so every route bundle in one server instance shares (and can clear) the same cache.
const counts = (globalThis.__straightpinCounts ??= new Map());
export async function liveCount(db: Db, q: JobQuery, now = Date.now()): Promise<{ count: number; agencyHidden: number }> {
  const key = `${db.app}|${JSON.stringify(q)}`;
  const hit = counts.get(key);
  if (hit && now - hit.at < COUNT_TTL_MS) return hit.value;
  const [count, agencyHidden] = await Promise.all([db.countJobs(q), db.countAgencyHidden(q)]);
  const value = { count: Math.max(0, count), agencyHidden: Math.max(0, agencyHidden) };
  if (counts.size > 500) counts.clear();
  counts.set(key, { at: now, value });
  return value;
}
export const clearCountCache = () => counts.clear();
