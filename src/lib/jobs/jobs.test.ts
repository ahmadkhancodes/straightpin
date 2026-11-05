import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { fakeFetcher } from "@/lib/crawl/adapters/__fixtures__/fake-fetcher";
import { NONE } from "@/lib/billing/entitlement";
import { createMemoryDb } from "@/lib/db/memory";
import type { Db } from "@/lib/db/types";
import type { MailMessage } from "@/lib/mail";
import { buildDigest, isDigestHour, localHour, runAlerts, runDigest } from "./digest";
import { fieldOfTitle, hourlyEquivalent, levelOfTitle, scheduleOf } from "./fields";
import { fixtureJobs, NOW } from "./fixtures";
import { formatPay } from "./format";
import { jobId } from "./ids";
import { buildUpserts, ingestEmployer, MAX_FAILS, rulesOnlyClassifier } from "./ingest";
import { leaseShard, runCrawlTick, seedSources } from "./crawlTick";
import { clearCountCache, liveCount, matchScore, parseAnswers, partialAnswers, queryFromAnswers, quizSchema, rankJobs } from "./matching";
import { consumeOpen, saveJobFor, unsaveJobFor } from "./meters";
import type { EmployerDoc, SearchProfile } from "./types";

const board = readFileSync(path.join(__dirname, "__fixtures__/greenhouse-board.json"), "utf8");
const BOARD_URL = "https://boards-api.greenhouse.io/v1/boards/oakfield/jobs?content=true";

const employer = (over: Partial<EmployerDoc> = {}): EmployerDoc => ({
  id: "greenhouse:oakfield", name: "Oakfield", ats: "greenhouse", slug: "oakfield", status: "active", failCount: 0,
  lastCrawledAt: null, nextCrawlAt: NOW, suppressed: false, seed: false, ...over,
});

let db: Db;
beforeEach(() => {
  db = createMemoryDb("straightpin");
  clearCountCache();
});

describe("taxonomy", () => {
  it("maps titles to the 8 fields and ignores the rest", () => {
    expect(fieldOfTitle("customer support specialist")).toBe("support");
    expect(fieldOfTitle("data entry clerk")).toBe("data-entry");
    expect(fieldOfTitle("executive assistant")).toBe("admin");
    expect(fieldOfTitle("accounts payable clerk")).toBe("finance");
    expect(fieldOfTitle("customer success associate")).toBe("sales");
    expect(fieldOfTitle("senior backend engineer")).toBeNull();
  });
  it("derives level, schedule and an hourly pay equivalent", () => {
    expect(levelOfTitle("senior customer support manager")).toBe("senior");
    expect(levelOfTitle("administrative assistant")).toBe("entry");
    expect(levelOfTitle("operations specialist")).toBe("mid");
    expect(scheduleOf("Part Time Support", "")).toBe("part");
    expect(scheduleOf("Support", "Full time role")).toBe("full");
    expect(hourlyEquivalent(52000, "year")).toBe(25);
    expect(hourlyEquivalent(20, "hour")).toBe(20);
    expect(hourlyEquivalent(null, "hour")).toBeNull();
  });
  it("formats pay with the right symbol", () => {
    expect(formatPay({ payMin: 19, payMax: 24, payPeriod: "hour", currency: "USD" })).toBe("$19 to $24 an hour");
    expect(formatPay({ payMin: 24500, payMax: 24500, payPeriod: "year", currency: "GBP" })).toBe("£24,500 a year");
    expect(formatPay({ payMin: null, payMax: null, payPeriod: null, currency: null })).toBeNull();
  });
});

describe("dedupe and scoring (buildUpserts)", () => {
  const nj = async () => {
    const f = fakeFetcher({ [BOARD_URL]: { body: board } });
    const { greenhouse } = await import("@/lib/crawl/adapters");
    return (await greenhouse.crawl({ ats: "greenhouse", slug: "oakfield" }, f)).jobs;
  };

  it("drops jobs outside the 8 fields and outside US/CA/UK, and collapses near duplicates", async () => {
    const r = buildUpserts(employer(), await nj(), { now: NOW, classify: rulesOnlyClassifier });
    expect(r.outsideFields).toBe(1); // Senior Backend Engineer (Berlin Executive Assistant never leaves the adapter)
    expect(r.duplicates).toBe(1); // 9002 repeats 9001
    expect(r.upserts.map((u) => u.externalId).sort()).toEqual(["9001", "9003", "9004"]);
  });

  it("a hard agency rule hides the post; a soft phrase alone goes to the review queue, not out of the list", async () => {
    const soft = buildUpserts(employer(), await nj(), { now: NOW, classify: rulesOnlyClassifier });
    expect(soft.upserts.find((u) => u.externalId === "9004")!.agencyFlag).toBe("pending");
    expect(soft.upserts.find((u) => u.externalId === "9001")!.agencyFlag).toBe("no");
    expect(soft.agencyHidden).toBe(0);
    const hard = buildUpserts(employer({ name: "Randstad" }), await nj(), { now: NOW, classify: rulesOnlyClassifier });
    expect(hard.upserts.every((u) => u.agencyFlag === "yes")).toBe(true);
    expect(hard.agencyHidden).toBe(hard.upserts.length);
  });

  it("uses the company's first published date, never a guess, and scores old postings", async () => {
    const r = buildUpserts(employer(), await nj(), { now: NOW, classify: rulesOnlyClassifier });
    const old = r.upserts.find((u) => u.externalId === "9003")!;
    expect(old.firstPublishedAt?.toISOString()).toBe("2026-09-01T09:00:00.000Z");
    expect(old.ghostScore).toBeGreaterThan(0);
    expect(old.schedule).toBe("part");
    expect(r.upserts.find((u) => u.externalId === "9001")!.ghostScore).toBe(0);
  });

  it("counts a repost when the same role came back under a new id within 90 days", async () => {
    const jobs = (await nj()).filter((j) => j.externalId === "9001");
    const first = buildUpserts(employer(), jobs, { now: NOW, classify: rulesOnlyClassifier }).upserts[0]!;
    const history = [
      { id: "old-closed", dedupeKey: first.dedupeKey, firstSeenAt: new Date(NOW.getTime() - 20 * 86_400_000) },
      { id: "ancient", dedupeKey: first.dedupeKey, firstSeenAt: new Date(NOW.getTime() - 200 * 86_400_000) },
      { id: first.id, dedupeKey: first.dedupeKey, firstSeenAt: NOW }, // itself, still listed: not a repost
    ];
    const again = buildUpserts(employer(), jobs, { now: NOW, classify: rulesOnlyClassifier, history }).upserts[0]!;
    expect(again.repostCount90d).toBe(1);
    expect(again.ghostScore).toBeGreaterThan(0);
  });
});

describe("ingestEmployer (upserts)", () => {
  it("is idempotent: a second crawl updates, never duplicates, and keeps the first seen time", async () => {
    await db.upsertEmployer({ name: "Oakfield", ats: "greenhouse", slug: "oakfield" }, NOW);
    const f = fakeFetcher({ [BOARD_URL]: { body: board, headers: { etag: 'W/"1"' } } });
    const e = (await db.getEmployer("greenhouse:oakfield"))!;
    const a = await ingestEmployer({ db, fetcher: f, now: NOW }, e);
    expect(a).toMatchObject({ seen: 5, inserted: 3, updated: 0, agencyHidden: 0 });
    const later = new Date(NOW.getTime() + 3_600_000);
    const b = await ingestEmployer({ db, fetcher: f, now: later }, (await db.getEmployer(e.id))!);
    expect(b).toMatchObject({ inserted: 0, updated: 3 });
    const j = (await db.getJob(jobId(e.id, "9001")))!;
    expect(j.firstSeenAt.getTime()).toBe(NOW.getTime());
    expect(j.excerpt).toContain("Help our members");
    expect(j.excerpt.length).toBeLessThanOrEqual(600);
    const after = (await db.getEmployer(e.id))!;
    expect(after.etag).toBe('W/"1"');
    expect(after.nextCrawlAt.getTime()).toBe(later.getTime() + 3_600_000);
  });

  it("closes a job missing on 2 crawls, and does not close anything on an empty answer", async () => {
    await db.upsertEmployer({ name: "Oakfield", ats: "greenhouse", slug: "oakfield" }, NOW);
    const id = "greenhouse:oakfield";
    const crawl = (body: string, at: number) => ingestEmployer({ db, fetcher: fakeFetcher({ [BOARD_URL]: { body } }), now: new Date(NOW.getTime() + at) }, employer({ id }));
    await crawl(board, 0);
    const without = JSON.stringify({ jobs: JSON.parse(board).jobs.filter((j: { id: number }) => j.id !== 9003) });
    expect((await crawl(without, 1)).closed).toBe(0);
    expect((await crawl(without, 2)).closed).toBe(1);
    expect((await db.getJob(jobId(id, "9003")))!.closedAt).not.toBeNull();
    expect((await crawl(JSON.stringify({ jobs: [] }), 3)).closed).toBe(0);
  });

  it("marks a board dead after 3 failures and backs off in between", async () => {
    await db.upsertEmployer({ name: "Gone", ats: "greenhouse", slug: "gone" }, NOW);
    const id = "greenhouse:gone";
    const f = fakeFetcher({}); // 404
    for (let i = 1; i <= MAX_FAILS; i++) {
      const out = await ingestEmployer({ db, fetcher: f, now: NOW }, (await db.getEmployer(id))!);
      expect(out.error).toContain("404");
      const e = (await db.getEmployer(id))!;
      expect(e.failCount).toBe(i);
      expect(e.status).toBe(i >= MAX_FAILS ? "dead" : "active");
      expect(e.nextCrawlAt.getTime()).toBeGreaterThan(NOW.getTime());
    }
    expect(await db.dueEmployers(new Date(NOW.getTime() + 999 * 3_600_000), 10)).toEqual([]);
  });

  it("a rate limited board waits at least 30 minutes without counting as a failure", async () => {
    await db.upsertEmployer({ name: "Busy", ats: "greenhouse", slug: "busy" }, NOW);
    const url = "https://boards-api.greenhouse.io/v1/boards/busy/jobs?content=true";
    const out = await ingestEmployer({ db, fetcher: fakeFetcher({ [url]: { status: 429, headers: { "retry-after": "60" } } }), now: NOW }, (await db.getEmployer("greenhouse:busy"))!);
    expect(out.error).toBeDefined();
    const e = (await db.getEmployer("greenhouse:busy"))!;
    expect(e.failCount).toBe(0);
    expect(e.nextCrawlAt.getTime()).toBeGreaterThanOrEqual(NOW.getTime() + 30 * 60_000);
  });
});

describe("leases and the crawl tick", () => {
  it("two workers get disjoint shards and an expired lease can be taken again", async () => {
    for (let i = 0; i < 8; i++) await db.upsertEmployer({ name: `E${i}`, ats: "greenhouse", slug: `e${i}` }, NOW);
    const a = await leaseShard(db, "A", NOW, 5, 1000);
    const b = await leaseShard(db, "B", NOW, 5, 1000);
    expect(a).toHaveLength(5);
    expect(b).toHaveLength(3);
    expect(new Set([...a, ...b].map((e) => e.id)).size).toBe(8);
    const later = new Date(NOW.getTime() + 2000);
    expect(await leaseShard(db, "C", later, 5, 1000)).toHaveLength(5);
  });

  it("seeds the labelled source list once", async () => {
    const n = await seedSources(db, NOW);
    expect(n).toBeGreaterThan(5);
    expect(await seedSources(db, NOW)).toBe(0);
    expect((await db.listEmployers()).every((e) => e.seed)).toBe(true);
  });

  it("runs a shard inside the budget, records the run and releases leases", async () => {
    await db.upsertEmployer({ name: "Oakfield", ats: "greenhouse", slug: "oakfield" }, NOW);
    const f = fakeFetcher({ [BOARD_URL]: { body: board } });
    // seeded boards are not in the fake fetcher: they 404 and are recorded as errors, the tick still completes
    const run = await runCrawlTick({ db, fetcher: f, now: () => NOW, shardSize: 100, concurrency: 2 }); // larger than the seed list, so Oakfield is in the shard
    expect(run.employers).toBeGreaterThanOrEqual(1);
    expect(run.inserted).toBe(3);
    expect(run.errors.length).toBeGreaterThan(0);
    expect((await db.listSourceRuns(1))[0]!.id).toBe(run.id);
    expect(await db.tryLease("greenhouse:oakfield", "someone", NOW, 1000)).toBe(true); // released
  });

  it("stops starting boards when the time budget is nearly spent", async () => {
    for (let i = 0; i < 6; i++) await db.upsertEmployer({ name: `E${i}`, ats: "greenhouse", slug: `e${i}` }, NOW);
    let t = NOW.getTime();
    const tick = () => new Date((t += 20_000)); // every clock read burns 20 s
    const run = await runCrawlTick({ db, fetcher: fakeFetcher({}), now: tick, budgetMs: 40_000, shardSize: 6, concurrency: 1 });
    expect(run.budgetHit).toBe(true);
    expect(run.employers).toBeLessThan(6);
    // unprocessed boards stay due for the next tick
    expect((await db.dueEmployers(new Date(t + 1), 50)).length).toBeGreaterThan(0);
  });
});

describe("metering: opens and saves", () => {
  const seedJobs = async () => {
    const jobs = fixtureJobs(NOW);
    await db.upsertJobs(jobs, NOW);
    return jobs;
  };

  it("free plan: 5 opens a day, re-opening a job is free, the 6th is refused and not counted", async () => {
    const jobs = await seedJobs();
    for (let i = 0; i < 5; i++) expect((await consumeOpen(db, "org1", jobs[i]!.id, NOW)).ok).toBe(true);
    const again = await consumeOpen(db, "org1", jobs[0]!.id, NOW);
    expect(again).toMatchObject({ ok: true, repeat: true });
    const sixth = await consumeOpen(db, "org1", jobs[5]!.id, NOW);
    expect(sixth.ok).toBe(false);
    expect(sixth.state).toMatchObject({ used: 5, limit: 5 });
    expect(await db.getUsage("org1", "opens", "2026-11-05")).toBe(5);
    expect(await db.hasOpened("org1", "2026-11-05", jobs[5]!.id)).toBe(false);
  });

  it("opens reset the next UTC day and are per org", async () => {
    const jobs = await seedJobs();
    for (let i = 0; i < 5; i++) await consumeOpen(db, "org1", jobs[i]!.id, NOW);
    const tomorrow = new Date(NOW.getTime() + 86_400_000);
    expect((await consumeOpen(db, "org1", jobs[6]!.id, tomorrow)).ok).toBe(true);
    expect((await consumeOpen(db, "org2", jobs[6]!.id, NOW)).ok).toBe(true);
  });

  it("paid plans are not capped", async () => {
    const jobs = await seedJobs();
    await db.setEntitlement("paid", { ...NONE(NOW.getTime()), isPaid: true, status: "active", plan: "monthly", interval: "month", expiresAt: NOW.getTime() + 86_400_000 * 30 });
    for (let i = 0; i < jobs.length; i++) expect((await consumeOpen(db, "paid", jobs[i]!.id, NOW)).ok).toBe(true);
  });

  it("saves: limit 10 on free, saving twice counts once, unsave frees a slot", async () => {
    const jobs = await seedJobs();
    for (let i = 0; i < 10; i++) expect((await saveJobFor(db, "org1", jobs[i]!.id, NOW)).ok).toBe(true);
    expect(await saveJobFor(db, "org1", jobs[0]!.id, NOW)).toMatchObject({ ok: true, created: false });
    const eleventh = await saveJobFor(db, "org1", jobs[10]!.id, NOW);
    expect(eleventh.ok).toBe(false);
    expect((await db.listSaved("org1")).length).toBe(10);
    expect(await db.getUsage("org1", "saves", "all")).toBe(10);
    expect(await unsaveJobFor(db, "org1", jobs[0]!.id)).toBe(true);
    expect(await unsaveJobFor(db, "org1", jobs[0]!.id)).toBe(false);
    expect((await saveJobFor(db, "org1", jobs[10]!.id, NOW)).ok).toBe(true);
  });
});

describe("matching and the live count", () => {
  const answers = quizSchema.parse({ field: "support", country: "US", remote: "remote_hybrid", payFloor: 18, level: "any", schedule: "any" });

  it("parses answers and the leading answered questions", () => {
    const p = new URLSearchParams("field=support&country=US&remote=nope&payFloor=20");
    expect(partialAnswers((k) => p.get(k))).toEqual({ field: "support", country: "US" });
    expect(parseAnswers((k) => p.get(k))).toBeUndefined();
    expect(queryFromAnswers(answers)).toMatchObject({ field: "support", country: "US", remoteTypes: ["remote", "hybrid"], payFloor: 18 });
    expect(queryFromAnswers({})).toEqual({});
  });

  it("counts from the database, never negative, hides agencies and reports the receipt number", async () => {
    await db.upsertJobs(fixtureJobs(NOW), NOW);
    const r = await liveCount(db, queryFromAnswers({ field: "support", country: "US" }));
    expect(r.count).toBeGreaterThan(0);
    expect(r.agencyHidden).toBe(1);
    expect((await liveCount(db, queryFromAnswers({ field: "marketing", country: "CA" }))).count).toBe(0);
  });

  it("serves a repeat count from the 60 s cache, then refreshes", async () => {
    await db.upsertJobs(fixtureJobs(NOW), NOW);
    const q = queryFromAnswers({ field: "data-entry" });
    const t0 = 1_000_000;
    const first = await liveCount(db, q, t0);
    await db.upsertJobs(fixtureJobs(NOW).map((j) => ({ ...j, id: `x${j.id}`, externalId: `x${j.externalId}` })), NOW);
    expect((await liveCount(db, q, t0 + 30_000)).count).toBe(first.count);
    expect((await liveCount(db, q, t0 + 61_000)).count).toBe(first.count * 2);
  });

  it("scores deterministically with a one line reason, and prefers fresh remote jobs over old ones", async () => {
    await db.upsertJobs(fixtureJobs(NOW), NOW);
    const pool = await db.queryJobs({ field: "support", country: "US", limit: 50 });
    const a = rankJobs(pool, answers, NOW);
    const b = rankJobs([...pool].reverse(), answers, NOW);
    expect(a.map((r) => r.job.id)).toEqual(b.map((r) => r.job.id));
    expect(a[0]!.reason).toMatch(/^[A-Z]/);
    const old = pool.find((j) => j.repostCount90d > 0)!;
    const fresh = pool.find((j) => j.title === "Customer Support Specialist" && j.remoteType === "remote")!;
    expect(matchScore(fresh, answers, NOW).score).toBeGreaterThan(matchScore(old, answers, NOW).score);
  });

  it("answers a count in well under 300 ms on 5,000 jobs (memory driver, uncached)", async () => {
    const base = fixtureJobs(NOW);
    const many = Array.from({ length: 5000 }, (_, i) => ({ ...base[i % base.length]!, id: `m${i}`, externalId: `m${i}` }));
    await db.upsertJobs(many, NOW);
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      clearCountCache();
      const t = performance.now();
      await liveCount(db, queryFromAnswers({ field: "support", country: "US", payFloor: i }));
      times.push(performance.now() - t);
    }
    expect(times.sort((x, y) => x - y)[18]).toBeLessThan(300);
  });
});

describe("digest and alerts", () => {
  const profile = (over: Partial<SearchProfile> = {}): SearchProfile => ({
    orgId: "org1", email: "ana@example.test", field: "support", country: "US", remote: "any", payFloor: 0, level: "any", schedule: "any",
    tz: "America/New_York", digest: true, alerts: true, lastDigestAt: null, lastAlertAt: null, updatedAt: NOW, ...over,
  });
  const sent: MailMessage[] = [];
  const send = async (m: MailMessage) => {
    sent.push(m);
    return { id: "x", provider: "test", accepted: true };
  };
  const unsub = async (email: string, scope: string) => `https://straightpin.test/api/mail/unsubscribe?e=${email}&s=${scope}`;
  // 13:00 UTC on 5 Nov 2026 is 08:00 in New York (EST, UTC-5)
  const EIGHT_NY = new Date("2026-11-05T13:00:00Z");

  beforeEach(() => {
    sent.length = 0;
  });

  it("finds the local hour, including a bad zone", () => {
    expect(localHour("America/New_York", EIGHT_NY)).toBe(8);
    expect(isDigestHour("America/New_York", EIGHT_NY)).toBe(true);
    expect(isDigestHour("Europe/London", EIGHT_NY)).toBe(false);
    expect(localHour("Not/AZone", EIGHT_NY)).toBe(13);
  });

  it("builds a digest with direct links, the receipt and an unsubscribe link, and nothing when empty", async () => {
    await db.upsertJobs(fixtureJobs(EIGHT_NY), EIGHT_NY);
    const fresh = await db.queryJobs({ field: "support", country: "US", limit: 20 });
    const msg = buildDigest(profile(), fresh, { kind: "digest", now: EIGHT_NY, unsubscribeUrl: "https://u.test/x", agencyHidden: 1 })!;
    expect(msg.category).toBe("digest");
    expect(msg.subject).toContain(`${fresh.length} new jobs`);
    expect(msg.text).toContain("We removed 1 staffing agency post from this list.");
    expect(msg.text).toContain("https://u.test/x");
    expect(msg.html).toContain("Unsubscribe in one click");
    expect(msg.text).toContain(`/job/${fresh[0]!.id}`);
    expect(buildDigest(profile(), [], { kind: "digest", now: EIGHT_NY, unsubscribeUrl: "u" })).toBeNull();
  });

  it("sends the free digest once a day at 08:00 local and not to paid or unsubscribed users", async () => {
    await db.upsertJobs(fixtureJobs(EIGHT_NY), EIGHT_NY);
    await db.saveProfile(profile());
    await db.saveProfile(profile({ orgId: "org2", email: "paid@example.test" }));
    await db.saveProfile(profile({ orgId: "org3", email: "off@example.test" }));
    await db.saveProfile(profile({ orgId: "org4", email: "london@example.test", tz: "Europe/London" }));
    await db.setEntitlement("org2", { ...NONE(EIGHT_NY.getTime()), isPaid: true, status: "active", plan: "weekly", interval: "week", expiresAt: EIGHT_NY.getTime() + 86_400_000 });
    await db.addSuppression({ email: "off@example.test", scope: "digest", reason: "unsubscribe" });

    const r = await runDigest(db, EIGHT_NY, send, unsub);
    expect(r).toEqual({ considered: 4, sent: 1, skipped: 3 });
    expect(sent.map((m) => m.to)).toEqual(["ana@example.test"]);
    expect(sent[0]!.text).toContain("s=digest");
    const again = await runDigest(db, new Date(EIGHT_NY.getTime() + 60_000), send, unsub);
    expect(again.sent).toBe(0);
    expect((await db.getProfile("org1"))!.lastDigestAt).not.toBeNull();
  });

  it("sends no digest when nothing is new", async () => {
    await db.saveProfile(profile());
    expect((await runDigest(db, EIGHT_NY, send, unsub)).sent).toBe(0);
  });

  it("paid users get alerts with new matches only, at most hourly; over 20 new becomes a summary", async () => {
    await db.saveProfile(profile({ orgId: "orgP", email: "paid@example.test" }));
    await db.setEntitlement("orgP", { ...NONE(NOW.getTime()), isPaid: true, status: "active", plan: "monthly", interval: "month", expiresAt: NOW.getTime() + 86_400_000 * 30 });
    await db.saveProfile(profile({ orgId: "orgF", email: "free@example.test" }));
    const base = fixtureJobs(NOW);
    const tpl = base.find((j) => j.field === "support" && j.agencyFlag === "no")!;
    const many = Array.from({ length: 25 }, (_, i) => ({ ...tpl, id: `n${i}`, externalId: `n${i}`, title: `Customer Support Agent ${i}` }));
    await db.upsertJobs(many, NOW);
    const t = new Date(NOW.getTime() + 60_000);
    const r = await runAlerts(db, t, send, unsub);
    expect(r.sent).toBe(1);
    expect(sent[0]!.to).toBe("paid@example.test");
    expect(sent[0]!.subject).toContain("25 new matches");
    expect(sent[0]!.text).toContain("15 more are waiting in your matches.");
    expect(sent[0]!.category).toBe("alerts");
    expect((await runAlerts(db, new Date(t.getTime() + 60_000), send, unsub)).sent).toBe(0); // within the hour
    await db.upsertJobs([{ ...tpl, id: "late", externalId: "late", title: "Customer Support Rep" }], new Date(t.getTime() + 2 * 3_600_000));
    expect((await runAlerts(db, new Date(t.getTime() + 2 * 3_600_000 + 1000), send, unsub)).sent).toBe(1);
    expect(sent[1]!.subject).toContain("1 new match ");
  });
});
