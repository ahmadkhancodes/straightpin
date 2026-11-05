import type { Db } from "@/lib/db/types";
import type { EmployerDoc, SourceRun } from "./types";

/** A source is switched off after this many crawls in a row failed. Robots blocks are handled elsewhere (status `blocked`). */
export const DISABLE_AFTER_FAILURES = 5;
/** How many recent runs the check reads. */
export const HEALTH_RUNS = 300;

export interface Disable { employerId: string; reason: string; failures: number }

/** Pure: crawl results per source, newest run first, that count back from the latest. Boards a run did not crawl are skipped. */
export function consecutiveFailures(employerId: string, runs: SourceRun[], since?: Date): { failures: number; lastError: string | null } {
  const newestFirst = [...runs].filter((r) => !since || r.startedAt > since).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  let failures = 0;
  let lastError: string | null = null;
  for (const r of newestFirst) {
    const b = r.boards?.find((x) => x.employerId === employerId);
    if (!b) continue;
    if (b.ok) break;
    failures++;
    lastError ??= r.errors.find((e) => e.employerId === employerId)?.message ?? null;
  }
  return { failures, lastError };
}

/** Pure: which active sources have failed `threshold` crawls in a row. Suppressed and already stopped sources are left alone. */
export function sourcesToDisable(employers: EmployerDoc[], runs: SourceRun[], threshold = DISABLE_AFTER_FAILURES): Disable[] {
  const out: Disable[] = [];
  for (const e of employers) {
    if (e.status !== "active" || e.suppressed) continue;
    const { failures, lastError } = consecutiveFailures(e.id, runs, e.healthResetAt);
    if (failures >= threshold) out.push({ employerId: e.id, failures, reason: `${failures} failed crawls in a row${lastError ? `: ${lastError.slice(0, 120)}` : ""}` });
  }
  return out;
}

/** Cron (daily). Disables failing sources so they stop eating crawl budget. An admin can switch one back to active. */
export async function runSourceHealthCheck(db: Db, now: Date, threshold = DISABLE_AFTER_FAILURES) {
  const [employers, runs] = await Promise.all([db.listEmployers(), db.listSourceRuns(HEALTH_RUNS)]);
  const disable = sourcesToDisable(employers, runs, threshold);
  for (const d of disable) await db.patchEmployer(d.employerId, { status: "disabled", disabledReason: d.reason, disabledAt: now });
  return { checked: employers.length, disabled: disable.map((d) => d.employerId) };
}

/** Put a disabled source back into the crawl (admin action). Its failure count restarts. */
export async function reenableSource(db: Db, employerId: string, now: Date): Promise<boolean> {
  const e = await db.getEmployer(employerId);
  if (!e || e.status === "active") return false;
  await db.patchEmployer(employerId, { status: "active", failCount: 0, nextCrawlAt: now, healthResetAt: now, disabledReason: undefined, disabledAt: undefined });
  return true;
}
