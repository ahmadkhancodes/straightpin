import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { NONE } from "@/lib/billing/entitlement";
import { createMemoryDb } from "@/lib/db/memory";
import type { Db } from "@/lib/db/types";
import type { MailMessage } from "@/lib/mail";
import { manageToken } from "@/lib/mail";
import { addAlertRule, parseAlertInput, verifyManageToken, withinLimit } from "./alertRules";
import { runAlerts } from "./digest";
import { FIELDS } from "./fields";
import { fixtureJobs, NOW } from "./fixtures";
import { jobPostingLd, ldScript } from "./jobPostingLd";
import { RETENTION, retentionStatement, runRetention } from "./retention";
import { buildIntro, eligibleCombos, generatePages, LOCATIONS, MIN_JOBS_FOR_PAGE, pageDescription, pagePath, pageQuery, pageStats, pageTitle, resolvePage } from "./seoPages";
import { consecutiveFailures, reenableSource, runSourceHealthCheck, sourcesToDisable } from "./sourceHealth";
import sources from "./sources.json";
import type { AlertRule, EmployerDoc, JobDoc, JobUpsert, SourceRun } from "./types";
import { seedSources } from "./crawlTick";
import { getAdapter } from "@/lib/crawl/adapters";
import { product } from "@/config/product";

const DAY = 86_400_000;
const ROOT = path.join(__dirname, "../../..");
let db: Db;
beforeEach(() => {
  db = createMemoryDb("straightpin");
});

const employer = (id: string, over: Partial<EmployerDoc> = {}): EmployerDoc => ({
  id, name: id, ats: "greenhouse", slug: id, status: "active", failCount: 0, lastCrawledAt: null, nextCrawlAt: NOW, suppressed: false, seed: true, ...over,
});
const run = (i: number, boards: { id: string; ok: boolean }[]): SourceRun => ({
  id: `r${i}`, kind: "crawl-tick", startedAt: new Date(NOW.getTime() + i * 60_000), finishedAt: new Date(NOW.getTime() + i * 60_000 + 1000),
  employers: boards.length, jobsSeen: 0, inserted: 0, updated: 0, closed: 0, agencyHidden: 0, budgetHit: false,
  boards: boards.map((b) => ({ employerId: b.id, ok: b.ok, inserted: 0, closed: 0 })),
  errors: boards.filter((b) => !b.ok).map((b) => ({ employerId: b.id, message: "HTTP 404" })),
});

describe("source list", () => {
  const list = sources.sources as { name: string; ats: string; slug: string; verified?: boolean; careersUrl?: string }[];
  it("covers the six hiring systems and career sites, is labelled seed data, and nothing is claimed as verified", () => {
    expect(new Set(list.map((s) => s.ats))).toEqual(new Set(["greenhouse", "lever", "ashby", "workable", "recruitee", "personio", "jsonld"]));
    expect(sources._note).toMatch(/^SEED DATA/);
    expect(list.every((s) => s.verified === false)).toBe(true);
    expect(new Set(list.map((s) => `${s.ats}:${s.slug}`)).size).toBe(list.length);
    for (const s of list.filter((x) => x.ats === "jsonld")) expect(new URL(s.careersUrl!).host).toBe(s.slug);
  });
  it("every non career source has an adapter, and seeding stores the verified flag", async () => {
    for (const s of list.filter((x) => x.ats !== "jsonld")) expect(getAdapter(s.ats as never), s.ats).not.toBeNull();
    await seedSources(db, NOW);
    expect((await db.listEmployers()).length).toBe(list.length);
    expect((await db.listEmployers()).every((e) => e.verified === false)).toBe(true);
  });
});

describe("source health", () => {
  const fails = (n: number, id = "a") => Array.from({ length: n }, (_, i) => run(i + 1, [{ id, ok: false }]));
  it("counts consecutive failures from the newest run and stops at a success", () => {
    const runs = [run(1, [{ id: "a", ok: true }]), run(2, [{ id: "a", ok: false }]), run(3, [{ id: "a", ok: false }]), run(4, [{ id: "b", ok: true }])];
    expect(consecutiveFailures("a", runs)).toEqual({ failures: 2, lastError: "HTTP 404" }); // run 4 did not crawl "a"
    expect(consecutiveFailures("b", runs).failures).toBe(0);
  });
  it("disables after 5 failures in a row, not 4, and ignores suppressed or stopped sources", () => {
    const e = [employer("a"), employer("s", { suppressed: true }), employer("d", { status: "dead" })];
    expect(sourcesToDisable(e, fails(4))).toEqual([]);
    const five = [...fails(5), ...fails(5, "s"), ...fails(5, "d")];
    expect(sourcesToDisable(e, five).map((d) => d.employerId)).toEqual(["a"]);
    expect(sourcesToDisable([employer("a")], [...fails(5), run(9, [{ id: "a", ok: true }])])).toEqual([]);
  });
  it("the cron switches the source off, the crawl no longer picks it up, and an admin can switch it back", async () => {
    await db.upsertEmployer({ name: "Gone", ats: "greenhouse", slug: "gone" }, NOW, true);
    for (const r of fails(5, "greenhouse:gone")) await db.recordSourceRun(r);
    const out = await runSourceHealthCheck(db, NOW);
    expect(out.disabled).toEqual(["greenhouse:gone"]);
    const e = (await db.getEmployer("greenhouse:gone"))!;
    expect(e.status).toBe("disabled");
    expect(e.disabledReason).toContain("5 failed crawls in a row");
    expect(await db.dueEmployers(new Date(NOW.getTime() + DAY), 10)).toEqual([]);
    expect(await reenableSource(db, "greenhouse:gone", new Date(NOW.getTime() + 600_000))).toBe(true);
    expect((await db.dueEmployers(new Date(NOW.getTime() + 600_000), 10)).map((x) => x.id)).toEqual(["greenhouse:gone"]);
    expect((await runSourceHealthCheck(db, new Date(NOW.getTime() + DAY))).disabled).toEqual([]); // the old failures do not count again after an admin enabled it
  });
});

const paid = (orgId: string, plan: "weekly" | "monthly" | "plus") =>
  db.setEntitlement(orgId, { ...NONE(NOW.getTime()), isPaid: true, status: "active", plan, interval: plan === "weekly" ? "week" : "month", expiresAt: NOW.getTime() + 30 * DAY });

describe("alert limits", () => {
  const input = (over: Record<string, unknown> = {}) => ({ field: "support", country: "US", location: "", payFloor: "", ...over });
  it("validates a rule", () => {
    expect(parseAlertInput(input({ location: "  Toronto   ON ", payFloor: "18.5" }))).toEqual({ ok: true, value: { field: "support", country: "US", location: "Toronto ON", payFloor: 18.5 } });
    expect(parseAlertInput(input({ field: "nope" })).ok).toBe(false);
    expect(parseAlertInput(input({ country: "FR" })).ok).toBe(false);
    expect(parseAlertInput(input({ payFloor: "-1" })).ok).toBe(false);
    expect(parseAlertInput(input({ payFloor: "abc" })).ok).toBe(false);
  });
  it("free plans cannot save alerts; paid plans stop at the plan's number", async () => {
    const ctx = { orgId: "o1", email: "Ana@Example.test" };
    const free = await addAlertRule(db, ctx, input(), NOW);
    expect(free).toMatchObject({ ok: false, error: "limit", limit: 0 });
    await paid("o1", "weekly");
    const limit = product.plans.find((p) => p.id === "weekly")!.alertLimit;
    expect(limit).toBeGreaterThan(0);
    for (let i = 0; i < limit; i++) expect((await addAlertRule(db, ctx, input({ location: `City ${i}` }), new Date(NOW.getTime() + i))).ok).toBe(true);
    const over = await addAlertRule(db, ctx, input(), NOW);
    expect(over).toMatchObject({ ok: false, error: "limit", limit });
    expect((await db.listAlertRules("o1")).length).toBe(limit);
    expect((await db.listAlertRules("o1"))[0]!.email).toBe("ana@example.test");
    // deleting one frees a slot
    const first = (await db.listAlertRules("o1"))[0]!;
    expect(await db.deleteAlertRule("o1", first.id)).toBe(true);
    expect((await addAlertRule(db, ctx, input(), NOW)).ok).toBe(true);
    expect(await db.deleteAlertRule("someone-else", first.id)).toBe(false);
  });
  it("a bigger plan has a bigger allowance, and downgrading keeps the oldest rules working", () => {
    const by = (id: string) => product.plans.find((p) => p.id === id)!.alertLimit;
    expect(by("free")).toBe(0);
    expect(by("plus")).toBeGreaterThan(by("monthly"));
    const rules = ["a", "b", "c", "d"].map((id) => ({ id }) as AlertRule);
    expect(withinLimit(rules, 2).map((r) => r.id)).toEqual(["a", "b"]);
    expect(withinLimit(rules, 0)).toEqual([]);
  });
});

describe("instant alerts per rule", () => {
  const sent: MailMessage[] = [];
  const send = async (m: MailMessage) => (sent.push(m), { id: "x", provider: "t", accepted: true });
  const unsub = async (e: string, s: string) => `https://u.test/unsub?e=${e}&s=${s}`;
  const manage = async (e: string) => `https://u.test/manage?e=${e}`;
  const base = () => fixtureJobs(NOW).find((j) => j.field === "support" && j.agencyFlag === "no")!;
  const job = (i: number, over: Partial<JobUpsert>): JobUpsert => ({ ...base(), id: `j${i}`, externalId: `j${i}`, title: `Customer Support Agent ${i}`, ...over });
  beforeEach(() => {
    sent.length = 0;
  });
  const T = new Date(NOW.getTime() + 60_000);

  it("sends one email per rule with its own filters, a label and a manage link", async () => {
    await paid("o1", "monthly");
    await db.saveProfile({ orgId: "o1", email: "ana@example.test", field: "support", country: "US", remote: "any", payFloor: 0, level: "any", schedule: "any", tz: "UTC", digest: true, alerts: true, lastDigestAt: null, lastAlertAt: null, updatedAt: NOW });
    await addAlertRule(db, { orgId: "o1", email: "ana@example.test" }, { field: "support", country: "CA", location: "Toronto" }, NOW);
    await addAlertRule(db, { orgId: "o1", email: "ana@example.test" }, { field: "support", country: "US", payFloor: 30 }, new Date(NOW.getTime() + 1));
    await db.upsertJobs([
      job(1, { country: "CA", location: "Toronto, ON", payHourlyMax: 22 }),
      job(2, { country: "CA", location: "Vancouver, BC", payHourlyMax: 22 }),
      job(3, { country: "US", location: "Austin, Texas", payHourlyMax: 21 }),
      job(4, { country: "US", location: "Remote", remoteType: "remote", payHourlyMax: 35 }),
    ], T);
    const r = await runAlerts(db, new Date(T.getTime() + 1000), send, unsub, manage);
    expect(r.sent).toBe(2); // the quiz profile does not add a third alert once the user has saved rules
    const toronto = sent.find((m) => m.subject.includes("Toronto"))!;
    expect(toronto.subject).toContain("1 new match for Customer support · Toronto, CA");
    expect(toronto.text).toContain("/job/j1");
    expect(toronto.text).not.toContain("/job/j2");
    expect(toronto.text).toContain("Change or delete your alerts: https://u.test/manage?e=ana@example.test");
    expect(toronto.html).toContain("Change or delete your alerts");
    const pay = sent.find((m) => m.subject.includes("$30+/hr"))!;
    expect(pay.text).toContain("/job/j4");
    expect(pay.text).not.toContain("/job/j3");
    // once an hour at most
    expect((await runAlerts(db, new Date(T.getTime() + 120_000), send, unsub, manage)).sent).toBe(0);
  });
  it("skips paused rules, unpaid orgs, and rules over the plan after a downgrade", async () => {
    await paid("o1", "weekly");
    const ctx = { orgId: "o1", email: "ana@example.test" };
    for (let i = 0; i < 3; i++) await addAlertRule(db, ctx, { field: "support", country: "US", location: `Austin${i}` }, new Date(NOW.getTime() + i));
    const rules = await db.listAlertRules("o1");
    await db.saveAlertRule({ ...rules[0]!, active: false });
    await db.upsertJobs([job(1, { location: "Austin0, Texas" }), job(2, { location: "Austin1, Texas" }), job(3, { location: "Austin2, Texas" })], T);
    expect((await runAlerts(db, new Date(T.getTime() + 1000), send, unsub, manage)).sent).toBe(2); // paused one is skipped
    // someone with rules but no paid plan gets nothing
    await db.saveAlertRule({ ...rules[0]!, id: "x1", orgId: "free-org", email: "f@example.test", createdAt: NOW, location: "Austin0" });
    sent.length = 0;
    await runAlerts(db, new Date(T.getTime() + 2 * 3_600_000), send, unsub, manage);
    expect(sent.some((m) => m.to === "f@example.test")).toBe(false);
  });
});

describe("signed manage link", () => {
  it("verifies for the same address only, ignoring case, and rejects tampering", async () => {
    const t = await manageToken("Ana@Example.test");
    expect(await verifyManageToken("ana@example.test", t)).toBe(true);
    expect(await verifyManageToken("bob@example.test", t)).toBe(false);
    expect(await verifyManageToken("ana@example.test", `${t.slice(0, -1)}${t.endsWith("0") ? "1" : "0"}`)).toBe(false);
    expect(await verifyManageToken("ana@example.test", "")).toBe(false);
    expect(await verifyManageToken("", t)).toBe(false);
  });
  it("a manage token is not an unsubscribe token (scopes differ)", async () => {
    const { unsubscribeToken } = await import("@/lib/mail");
    expect(await manageToken("a@b.test")).not.toBe(await unsubscribeToken("a@b.test", "manage"));
    expect(await manageToken("a@b.test")).not.toBe(await unsubscribeToken("a@b.test", "alerts"));
  });
  it("lists rules by email across orgs", async () => {
    const rule = (id: string, orgId: string, email: string): AlertRule => ({ id, orgId, email, field: "support", country: "US", location: "", payFloor: 0, active: true, createdAt: NOW, lastSentAt: null });
    await db.saveAlertRule(rule("1", "o1", "ana@example.test"));
    await db.saveAlertRule(rule("2", "o2", "bob@example.test"));
    expect((await db.listAlertRulesByEmail("ANA@example.test")).map((r) => r.id)).toEqual(["1"]);
  });
  it("the manage page and route use the token before touching data", () => {
    const route = readFileSync(path.join(ROOT, "src/app/api/alerts/manage/route.ts"), "utf8");
    expect(route.indexOf("verifyManageToken")).toBeGreaterThan(-1);
    expect(route.indexOf("verifyManageToken")).toBeLessThan(route.indexOf("getDb()"));
    expect(route).toContain("listAlertRulesByEmail(e)"); // only rules saved under the signed email
  });
});

describe("retention", () => {
  const closedJob = (id: string): JobUpsert => ({ ...fixtureJobs(NOW)[0]!, id, externalId: id });
  async function seed() {
    await db.upsertJobs([closedJob("old"), closedJob("edge"), closedJob("fresh"), closedJob("open")], NOW);
    const closeAt = (id: string, days: number) => db.closeByExternalIds(fixtureJobs(NOW)[0]!.employerId, [id], new Date(NOW.getTime() - days * DAY));
    await closeAt("old", RETENTION.closedJobDays + 1);
    await closeAt("edge", RETENTION.closedJobDays - 1);
    await closeAt("fresh", 1);
  }
  it("deletes jobs closed longer ago than the stated period, and only those", async () => {
    await seed();
    await db.saveJob("org1", "old", NOW);
    await db.saveJob("org1", "open", NOW);
    const r = await runRetention(db, NOW);
    expect(r.closedJobs).toBe(1);
    expect(await db.getJob("old")).toBeNull();
    expect(await db.getJob("edge")).not.toBeNull();
    expect(await db.getJob("fresh")).not.toBeNull();
    expect(await db.getJob("open")).not.toBeNull(); // open jobs are never purged
    expect((await db.listSaved("org1")).map((s) => s.jobId)).toEqual(["open"]); // gone from saved lists too
    expect((await runRetention(db, NOW)).closedJobs).toBe(0); // idempotent
  });
  it("deletes crawl records older than the stated period", async () => {
    const mk = (id: string, daysAgo: number): SourceRun => ({ ...run(0, []), id, startedAt: new Date(NOW.getTime() - daysAgo * DAY), finishedAt: new Date(NOW.getTime() - daysAgo * DAY + 1000) });
    await db.recordSourceRun(mk("old", RETENTION.crawlRecordDays + 1));
    await db.recordSourceRun(mk("new", RETENTION.crawlRecordDays - 1));
    expect((await runRetention(db, NOW)).crawlRecords).toBe(1);
    expect((await db.listSourceRuns(10)).map((r) => r.id)).toEqual(["new"]);
  });
  it("the claim on /about/data and the code agree", () => {
    const st = retentionStatement();
    expect(st.closedJobs).toContain(`${RETENTION.closedJobDays} days`);
    expect(st.crawlRecords).toContain(`${RETENTION.crawlRecordDays} days`);
    const page = readFileSync(path.join(ROOT, "src/app/(marketing)/about/data/page.tsx"), "utf8");
    expect(page).toContain("retentionStatement()");
    expect(page).toContain("retention.closedJobs");
    expect(page).toContain("retention.crawlRecords");
    // no second, hand typed number on the page can contradict the constants
    expect(page).not.toMatch(/\b\d+ days\b/);
    // the Mongo TTL backstop for crawl records reads the same constant
    expect(readFileSync(path.join(ROOT, "src/lib/db/mongo.ts"), "utf8")).toContain("CRAWL_RECORD_DAYS");
  });
  it("is registered as a daily cron job", () => {
    expect(readFileSync(path.join(ROOT, "infra/cron-worker/wrangler.toml"), "utf8")).toMatch(/DAILY_JOBS = ".*retention.*"/);
    expect(readFileSync(path.join(ROOT, "src/lib/cron/jobs.ts"), "utf8")).toMatch(/retention[,:]/);
  });
  it("account export includes saved alerts and deletion removes them", async () => {
    await db.saveAlertRule({ id: "r1", orgId: "o1", email: "a@b.test", field: "support", country: "US", location: "", payFloor: 0, active: true, createdAt: NOW, lastSentAt: null });
    expect(((await db.exportOrgData("o1")).alertRules as unknown[]).length).toBe(1);
    await db.deleteOrgData("o1");
    expect(await db.listAlertRules("o1")).toEqual([]);
  });
});

describe("programmatic pages", () => {
  const tpl = () => fixtureJobs(NOW).find((j) => j.field === "support" && j.agencyFlag === "no")!;
  const many = (n: number, over: Partial<JobUpsert>, prefix = "p"): JobUpsert[] => Array.from({ length: n }, (_, i) => ({ ...tpl(), id: `${prefix}${i}`, externalId: `${prefix}${i}`, employerName: `Employer ${i % 3}`, ...over }));

  it("covers the 8 fields and the major US, CA and UK places with unique slugs", () => {
    expect(FIELDS).toHaveLength(8);
    expect(new Set(LOCATIONS.map((l) => l.slug)).size).toBe(LOCATIONS.length);
    for (const c of ["US", "CA", "UK"]) expect(LOCATIONS.some((l) => l.kind === "city" && l.country === c)).toBe(true);
    for (const slug of ["toronto", "vancouver", "london", "manchester"]) expect(LOCATIONS.some((l) => l.slug === slug)).toBe(true);
  });
  it("a combination gets a page only at the minimum number of jobs", () => {
    const loc = LOCATIONS.find((l) => l.slug === "toronto")!;
    const combos = [{ field: "support" as const, location: loc, count: MIN_JOBS_FOR_PAGE - 1 }, { field: "admin" as const, location: loc, count: MIN_JOBS_FOR_PAGE }, { field: "sales" as const, location: loc, count: MIN_JOBS_FOR_PAGE + 5 }];
    expect(eligibleCombos(combos).map((c) => c.field)).toEqual(["sales", "admin"]);
    expect(eligibleCombos(combos, 1)).toHaveLength(3);
  });
  it("generates pages from the database, counting only open non agency jobs in the right place", async () => {
    await db.upsertJobs([
      ...many(MIN_JOBS_FOR_PAGE, { country: "CA", location: "Toronto, ON", remoteType: "onsite" }, "t"),
      ...many(MIN_JOBS_FOR_PAGE - 1, { country: "CA", location: "Vancouver, BC", remoteType: "onsite" }, "v"),
      ...many(MIN_JOBS_FOR_PAGE, { country: "UK", location: "London", remoteType: "onsite", agencyFlag: "yes" }, "a"), // agency: hidden, not counted
      ...many(MIN_JOBS_FOR_PAGE, { country: "US", location: "Remote", remoteType: "remote" }, "r"),
    ], NOW);
    const pages = (await generatePages(db)).map((c) => pagePath(c.field, c.location));
    expect(pages).toContain("/jobs/support/toronto");
    expect(pages).toContain("/jobs/support/canada"); // 8 Toronto + 7 Vancouver
    expect(pages).toContain("/jobs/support/remote");
    expect(pages).toContain("/jobs/support/united-states");
    expect(pages).not.toContain("/jobs/support/vancouver");
    expect(pages).not.toContain("/jobs/support/london");
    expect(pages).not.toContain("/jobs/admin/toronto");
    expect(await db.countJobs(pageQuery("support", LOCATIONS.find((l) => l.slug === "toronto")!))).toBe(MIN_JOBS_FOR_PAGE);
  });
  it("rejects unknown fields and places", () => {
    expect(resolvePage("support", "toronto")?.location.label).toBe("Toronto");
    expect(resolvePage("juggling", "toronto")).toBeNull();
    expect(resolvePage("support", "atlantis")).toBeNull();
  });
  it("intros come from the data: different pages differ, and a sentence appears only when its number exists", () => {
    const toronto = LOCATIONS.find((l) => l.slug === "toronto")!;
    const london = LOCATIONS.find((l) => l.slug === "london")!;
    const tj = many(10, { country: "CA", location: "Toronto, ON", remoteType: "onsite", payHourlyMax: 24, currency: "CAD" }, "t").map((j, i) => ({ ...j, firstPublishedAt: new Date(NOW.getTime() - (i + 1) * DAY) }) as JobDoc);
    const lj = many(12, { country: "UK", location: "London", remoteType: "hybrid", payHourlyMax: null, currency: null }, "l").map((j, i) => ({ ...j, firstPublishedAt: new Date(NOW.getTime() - (i + 40) * DAY) }) as JobDoc);
    const a = buildIntro("support", toronto, pageStats(tj, 31, NOW)).join("\n");
    const b = buildIntro("support", london, pageStats(lj, 12, NOW)).join("\n");
    expect(a).not.toBe(b);
    expect(a).toContain("31");
    expect(a).toContain("C$24 an hour");
    expect(a).toContain("first posted 1 day ago");
    expect(b).toContain("None of the newest 12 show pay");
    expect(b).toContain("12 are hybrid".replace("12 are", "12 are")); // all 12 hybrid
    expect(b).toContain("Old posting");
    expect(a).not.toContain("Old posting");
    // the same stats on another field/place give different wording or shape, not the same text with a swapped name
    const c = buildIntro("admin", toronto, pageStats(tj, 31, NOW)).join("\n");
    expect(c.replace(/administrative|admin and executive assistant/gi, "X")).not.toBe(a.replace(/customer support/gi, "X"));
  });
  it("titles and descriptions are specific", () => {
    const toronto = LOCATIONS.find((l) => l.slug === "toronto")!;
    const s = pageStats([], 9, NOW);
    expect(pageTitle("data-entry", toronto)).toBe("Data entry jobs in Toronto direct from company");
    expect(pageTitle("support", LOCATIONS[0]!)).toBe("Remote customer support jobs direct from company");
    expect(pageDescription("data-entry", toronto, s)).toContain("9 data entry jobs in Toronto");
  });
  it("the page sets a canonical tag, is cached, and the sitemap lists the pages", () => {
    const page = readFileSync(path.join(ROOT, "src/app/(jobs)/jobs/[field]/[location]/page.tsx"), "utf8");
    expect(page).toContain("pageMetadata("); // pageMetadata sets alternates.canonical
    expect(page).toContain("revalidate = 3600");
    expect(page).toContain("MIN_JOBS_FOR_PAGE");
    expect(readFileSync(path.join(ROOT, "src/app/sitemap.ts"), "utf8")).toContain("generatePagesCached");
    expect(readFileSync(path.join(ROOT, "src/app/(jobs)/job/[id]/page.tsx"), "utf8")).toContain("jobPostingLd(job)");
  });
});

describe("JobPosting JSON-LD", () => {
  const open = (over: Partial<JobDoc> = {}): JobDoc => ({ ...fixtureJobs(NOW)[0]!, firstSeenAt: NOW, lastSeenAt: NOW, closedAt: null, missCount: 0, postedAt: NOW, ...over }) as JobDoc;
  it("points at our job page (never the employer's apply link) and uses the company's own posted date", () => {
    const j = open({ firstPublishedAt: new Date("2026-11-03T09:00:00Z"), firstSeenAt: new Date("2026-11-05T00:00:00Z"), applyUrl: "https://boards.greenhouse.io/acme/jobs/1", title: "Customer Support Specialist" });
    const ld = jobPostingLd(j)!;
    expect(ld["@type"]).toBe("JobPosting");
    expect(ld.url).toBe(`${product.url}/job/${encodeURIComponent(j.id)}`);
    expect(ldScript(ld)).not.toContain("boards.greenhouse.io/acme/jobs/1");
    expect(ld.directApply).toBe(false);
    expect(ld.datePosted).toBe("2026-11-03");
    expect(ld.hiringOrganization).toEqual({ "@type": "Organization", name: j.employerName });
    expect(ld.employmentType).toBe("FULL_TIME");
    expect(ld.description).toBe(j.excerpt);
  });
  it("remote jobs say so, on site jobs carry an address, pay becomes a MonetaryAmount", () => {
    const remote = jobPostingLd(open({ remoteType: "remote", location: null, country: "CA" }))!;
    expect(remote.jobLocationType).toBe("TELECOMMUTE");
    expect(remote.applicantLocationRequirements).toEqual({ "@type": "Country", name: "CA" });
    expect(remote.jobLocation).toBeUndefined();
    const site = jobPostingLd(open({ remoteType: "onsite", location: "Manchester", country: "UK", payMin: 24500, payMax: 26000, payPeriod: "year", currency: "GBP", schedule: "part" }))!;
    expect(site.jobLocation).toEqual({ "@type": "Place", address: { "@type": "PostalAddress", addressLocality: "Manchester", addressCountry: "GB" } });
    expect(site.baseSalary).toEqual({ "@type": "MonetaryAmount", currency: "GBP", value: { "@type": "QuantitativeValue", minValue: 24500, maxValue: 26000, unitText: "YEAR" } });
    expect(site.employmentType).toBe("PART_TIME");
    expect(jobPostingLd(open({ payMin: null, payMax: null }))!.baseSalary).toBeUndefined();
  });
  it("includes validThrough when the company gave one, and none for a closed job", () => {
    expect(jobPostingLd(open({ validThrough: new Date("2026-12-01T00:00:00Z") }))!.validThrough).toBe("2026-12-01T00:00:00.000Z");
    expect(jobPostingLd(open({ closedAt: NOW }))).toBeNull();
  });
  it("escapes the script payload so a title cannot close the tag", () => {
    const out = ldScript(jobPostingLd(open({ title: "</script><b>x" }))!);
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).title).toBe("</script><b>x");
  });
});

describe("launch prep", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = path.join(dir, n);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
    });
  it("every {{placeholder}} in the code is listed in docs/MANUAL_STEPS.md", () => {
    const manual = readFileSync(path.join(ROOT, "docs/MANUAL_STEPS.md"), "utf8");
    const found = new Set<string>();
    for (const f of files(path.join(ROOT, "src"))) for (const m of readFileSync(f, "utf8").matchAll(/\{\{([a-z][a-z _]*)\}\}/g)) found.add(m[0]);
    // No placeholders left is fine (all filled in on 10 Nov); any that reappear must be listed in MANUAL_STEPS.md.
    for (const ph of found) expect(manual, `${ph} missing from MANUAL_STEPS.md`).toContain(ph);
  });
  it("the launch checklist covers the required areas", () => {
    const doc = readFileSync(path.join(ROOT, "docs/LAUNCH_CHECKLIST.md"), "utf8").toLowerCase();
    for (const w of ["placeholder", "secret", "cron worker", "db:indexes", "stripe live", "trademark", "legal", "first 100"]) expect(doc, w).toContain(w);
  });
});
