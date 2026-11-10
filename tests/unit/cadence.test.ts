import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cadence, CADENCE, plans } from "@/config/product";
import sources from "@/lib/jobs/sources.json";

const root = join(__dirname, "..", "..");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
const files = walk(join(root, "src")).filter((f) => !f.endsWith("config/product.ts"));
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** Claims that only an hourly or real-time scheduler can meet. Production is daily (Vercel Hobby). */
const FAST_CLAIMS = [/every hour/i, /within the hour/i, /within an hour/i, /every \d+ minutes/i, /within minutes/i, /\d+ min(ute)?s? ago/i, /real[- ]time/i, /at most once an hour/i, /instant alert/i];

describe("cadence honesty", () => {
  it("daily cadence: no page copy makes a claim that production cannot meet", () => {
    if (CADENCE !== "daily") return; // flipped on purpose: the copy then comes from `cadence` anyway
    const hits: string[] = [];
    for (const f of files) {
      if (f.includes("/content/sample-jobs") || f.includes("/mail/templates")) continue;
      const text = readFileSync(f, "utf8");
      for (const re of FAST_CLAIMS) if (re.test(text)) hits.push(`${f.replace(root, "")}: ${re}`);
    }
    expect(hits).toEqual([]);
  });

  it("the constant drives the public copy", () => {
    expect(cadence.id).toBe(CADENCE);
    expect(cadence.checkPhrase).toBe(CADENCE === "daily" ? "every day" : "every hour");
    for (const rel of ["src/app/(marketing)/page.tsx", "src/app/(marketing)/how-we-check/page.tsx", "src/content/docs/getting-started.ts", "src/app/(jobs)/alerts/page.tsx", "src/app/(jobs)/matches/page.tsx"]) {
      expect(read(rel), rel).toContain("cadence.");
    }
    for (const p of plans) for (const h of p.highlights) for (const re of CADENCE === "daily" ? FAST_CLAIMS : []) expect(h).not.toMatch(re);
  });

  it("vercel.json: crawl-tick first, webhook-retries second, both daily (Hobby allows two daily crons)", () => {
    const { crons } = JSON.parse(read("vercel.json")) as { crons: { path: string; schedule: string }[] };
    expect(crons.map((c) => c.path)).toEqual(["/api/cron/crawl-tick", "/api/cron/webhook-retries"]);
    for (const c of crons) expect(c.schedule).toMatch(/^\d+ \d+ \* \* \*$/);
  });

  it("the daily entries fold the digest, alerts, renewals, source health and retention jobs", () => {
    const src = read("src/lib/cron/jobs.ts");
    expect(src).toMatch(/"crawl-tick": async \(\) => sequence\(\{ crawl, "source-health": sourceHealth, retention \}\)/);
    expect(src).toMatch(/"webhook-retries": async \(\) => sequence\(\{ webhooks, digest, alerts, "renewal-reminders": renewals \}\)/);
  });

  it("Ashby seeds are disabled with the robots.txt reason", () => {
    const ashby = sources.sources.filter((s) => s.ats === "ashby");
    expect(ashby.length).toBeGreaterThan(0);
    for (const s of ashby) {
      expect(s).toMatchObject({ status: "disabled" });
      expect((s as { disabledReason?: string }).disabledReason).toMatch(/robots\.txt/);
    }
  });
});
