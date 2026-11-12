import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureJobs, NOW } from "@/lib/jobs/fixtures";
import { NONE } from "@/lib/billing/entitlement";
import { createMemoryDb } from "@/lib/db/memory";
import type { Db } from "@/lib/db/types";
import type { OrgContext } from "@/lib/auth/session";

let db: Db;
let who: OrgContext | null;
let getDbImpl: () => Promise<Db>;
vi.mock("@/lib/db", () => ({ getDb: () => getDbImpl() }));
vi.mock("@/lib/auth/session", () => ({ getOrgContext: async () => who }));

import { POST as savedPost } from "@/app/api/saved/route";
import { GET as savedExport } from "@/app/api/saved/export/route";
import { POST as alertsPost } from "@/app/api/alerts/route";
import { POST as managePost } from "@/app/api/alerts/manage/route";
import { POST as openPost } from "@/app/api/jobs/[id]/open/route";
import { GET as countsGet } from "@/app/api/counts/route";
import { manageToken } from "@/lib/mail";
import { clientIp, limitRequest, problemRedirect, PROBLEMS } from "@/lib/security/guard";
import { mayMail, RULES } from "@/lib/security/ratelimit";
import { csvCell, toCsv } from "@/lib/jobs/csv";
import { firstRunSteps } from "@/lib/jobs/checklist";
import { scrub } from "@/lib/logger";

const ORIGIN = "http://localhost:3000";
const ctxFor = (id: string, email: string): OrgContext => ({ user: { id: `u-${id}`, email, name: id, emailVerified: true }, sessionId: `s-${id}`, org: { id: `org-${id}`, name: id, slug: id }, role: "owner" });
const A = ctxFor("a", "a@x.test");
const B = ctxFor("b", "b@x.test");
const form = (url: string, fields: Record<string, string>, ip = "1.1.1.1") =>
  new Request(`${ORIGIN}${url}`, { method: "POST", body: new URLSearchParams(fields), headers: { "content-type": "application/x-www-form-urlencoded", origin: ORIGIN, "x-forwarded-for": ip } });
const jsonReq = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${url}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", accept: "application/json", origin: ORIGIN, ...headers } });

let jobIds: string[];
beforeEach(async () => {
  db = createMemoryDb("straightpin");
  getDbImpl = async () => db;
  who = A;
  const jobs = fixtureJobs(NOW);
  await db.upsertJobs(jobs, NOW);
  jobIds = jobs.map((j) => j.id);
  // Paid plan for both so alerts can be added
  for (const o of ["org-a", "org-b"]) await db.setEntitlement(o, { ...NONE(Date.now()), isPaid: true, status: "active", plan: "monthly", interval: "month", expiresAt: Date.now() + 86_400_000 * 30 });
});

describe("tenant isolation", () => {
  it("B cannot see, remove or count against A's saved jobs, even with A's exact job id", async () => {
    who = A;
    await savedPost(form("/api/saved", { jobId: jobIds[0]!, action: "save" }));
    who = B;
    await savedPost(form("/api/saved", { jobId: jobIds[0]!, action: "unsave" }));
    expect((await db.listSaved("org-a")).map((s) => s.jobId)).toEqual([jobIds[0]]);
    expect(await db.listSaved("org-b")).toEqual([]);
    expect(await db.getUsage("org-a", "saves", "all")).toBe(1);
    expect(await db.getUsage("org-b", "saves", "all")).toBe(0);
  });

  it("the CSV export only holds the caller's saved jobs", async () => {
    who = A;
    await savedPost(form("/api/saved", { jobId: jobIds[0]!, action: "save" }));
    who = B;
    await savedPost(form("/api/saved", { jobId: jobIds[1]!, action: "save" }));
    const csv = await (await savedExport(new Request(`${ORIGIN}/api/saved/export`))).text();
    expect(csv).toContain(jobIds[1]!);
    expect(csv).not.toContain(jobIds[0]!);
    expect(csv.split("\r\n")[0]).toContain("Title");
  });

  it("the CSV export never carries the employer apply link (open limit cannot be skipped)", async () => {
    await savedPost(form("/api/saved", { jobId: jobIds[0]!, action: "save" }));
    const job = (await db.getJob(jobIds[0]!))!;
    const csv = await (await savedExport(new Request(`${ORIGIN}/api/saved/export`))).text();
    expect(csv).not.toContain(job.applyUrl);
  });

  it("signed out export goes to sign in", async () => {
    who = null;
    const res = await savedExport(new Request(`${ORIGIN}/api/saved/export`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("B cannot pause, resume or delete A's alert rule by id", async () => {
    who = A;
    await alertsPost(form("/api/alerts", { action: "add", field: "support", country: "US" }));
    const rule = (await db.listAlertRules("org-a"))[0]!;
    who = B;
    for (const action of ["delete", "pause", "resume"]) {
      const res = await alertsPost(form("/api/alerts", { action, id: rule.id }));
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toContain("/problem?code=not_found");
    }
    const after = (await db.listAlertRules("org-a"))[0]!;
    expect(after.active).toBe(true);
  });

  it("a manage link for one address cannot touch another address's rules, and a forged token is refused", async () => {
    who = A;
    await alertsPost(form("/api/alerts", { action: "add", field: "support", country: "US" }));
    who = B;
    await alertsPost(form("/api/alerts", { action: "add", field: "sales", country: "US" }));
    const ruleB = (await db.listAlertRules("org-b"))[0]!;
    const tokenA = await manageToken("a@x.test");
    const r1 = await managePost(form("/api/alerts/manage", { e: "a@x.test", t: tokenA, action: "delete", id: ruleB.id }));
    expect(r1.headers.get("location")).toContain("code=not_found");
    const r2 = await managePost(form("/api/alerts/manage", { e: "b@x.test", t: tokenA, action: "delete", id: ruleB.id }));
    expect(r2.headers.get("location")).toContain("code=invalid_link");
    expect(await db.listAlertRules("org-b")).toHaveLength(1);
  });

  it("opens are metered per organisation", async () => {
    who = A;
    for (let i = 0; i < 5; i++) expect((await openPost(jsonReq(`/api/jobs/${jobIds[0]}/open`, {}), { params: Promise.resolve({ id: jobIds[i % jobIds.length]! }) })).status).toBeLessThan(500);
    who = B;
    const res = await openPost(jsonReq(`/api/jobs/${jobIds[0]}/open`, {}), { params: Promise.resolve({ id: jobIds[0]! }) });
    expect(res.status).toBe(200);
  });

  it("signed out callers get 401 on JSON routes and never data", async () => {
    who = null;
    expect((await savedPost(jsonReq("/api/saved", { jobId: jobIds[0] }))).status).toBe(401);
  });
});

describe("open route without JavaScript", () => {
  it("answers with a link page, not a cross-site redirect that CSP would swallow", async () => {
    const job = (await db.getJob(jobIds[0]!))!;
    const res = await openPost(form(`/api/jobs/${job.id}/open`, {}), { params: Promise.resolve({ id: job.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    const html = await res.text();
    expect(html).toContain(`href="${job.applyUrl.replace(/&/g, "&#38;")}"`);
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("a hostile employer name is escaped", async () => {
    const job = (await db.getJob(jobIds[0]!))!;
    await db.upsertJobs([{ ...job, employerName: '<img src=x onerror=alert(1)>' } as never], NOW).catch(() => undefined);
    const res = await openPost(form(`/api/jobs/${job.id}/open`, {}), { params: Promise.resolve({ id: job.id }) });
    expect(await res.text()).not.toContain("<img src=x");
  });
});

describe("rate limits and abuse controls", () => {
  it("limitRequest answers 429 after the limit, per caller, and a different caller is unaffected", async () => {
    const rule = { limit: 3, windowMs: 60_000 };
    const req = (ip: string) => new Request(ORIGIN, { headers: { "x-forwarded-for": ip } });
    for (let i = 0; i < 3; i++) await limitRequest(req("9.9.9.9"), "t1", rule);
    await expect(limitRequest(req("9.9.9.9"), "t1", rule)).rejects.toMatchObject({ status: 429, code: "rate_limited" });
    await expect(limitRequest(req("8.8.8.8"), "t1", rule)).resolves.toBeUndefined();
  });

  it("the limiter store being down never blocks the request", async () => {
    getDbImpl = async () => { throw new Error("down"); };
    await expect(limitRequest(new Request(ORIGIN), "t2", { limit: 1, windowMs: 1000 })).resolves.toBeUndefined();
  });

  it("the saved route throttles a single organisation hammering it", async () => {
    let last = 0;
    for (let i = 0; i < RULES.userAction.limit + 5; i++) last = (await savedPost(jsonReq("/api/saved", { jobId: jobIds[0], action: "unsave" }))).status;
    expect(last).toBe(429);
  });

  it("the manage endpoint throttles guessing by IP", async () => {
    let last: Response | null = null;
    for (let i = 0; i < RULES.publicSigned.limit + 3; i++) last = await managePost(form("/api/alerts/manage", { e: "a@x.test", t: "bad", action: "delete" }, "7.7.7.7"));
    expect(last!.headers.get("location")).toContain("code=rate_limited");
  });

  it("the public count endpoint throttles by IP and says when to retry", async () => {
    let res: Response | null = null;
    for (let i = 0; i < RULES.publicRead.limit + 2; i++) res = await countsGet(new Request(`${ORIGIN}/api/counts?field=support`, { headers: { "x-forwarded-for": "6.6.6.6" } }));
    expect(res!.status).toBe(429);
    expect(res!.headers.get("retry-after")).toBe("60");
  });

  it("magic link mail to one inbox is capped however many IPs ask", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < RULES.authEmail.limit + 2; i++) results.push(await mayMail("magic", "Victim@X.test", RULES.authEmail, db));
    expect(results.filter(Boolean)).toHaveLength(RULES.authEmail.limit);
    expect(await mayMail("magic", "other@x.test", RULES.authEmail, db)).toBe(true);
  });

  it("clientIp is bounded and clean", () => {
    expect(clientIp(new Request(ORIGIN, { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } }))).toBe("1.2.3.4");
    expect(clientIp(new Request(ORIGIN, { headers: { "x-forwarded-for": "<script>".repeat(30) } })).length).toBeLessThanOrEqual(64);
    expect(clientIp(new Request(ORIGIN))).toBe("unknown");
  });
});

describe("resilience: failures say what happened and what to do", () => {
  it("database down on a form post gives a readable page, not a blank 500 or JSON", async () => {
    getDbImpl = async () => { throw new Error("connect ECONNREFUSED 10.1.2.3:27017 mongodb+srv://user:pw@host"); };
    const res = await savedPost(form("/api/saved", { jobId: jobIds[0]!, action: "save" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/problem?code=server_error");
    expect(res.headers.get("location")).not.toContain("mongodb");
  });
  it("database down on a JSON call gives a short code and no internals", async () => {
    getDbImpl = async () => { throw new Error("connect ECONNREFUSED 10.1.2.3:27017"); };
    const res = await savedPost(jsonReq("/api/saved", { jobId: jobIds[0] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server_error" });
  });
  it("the live count degrades to 503 JSON when the database is down", async () => {
    getDbImpl = async () => { throw new Error("down"); };
    const res = await countsGet(new Request(`${ORIGIN}/api/counts?field=support`, { headers: { "x-forwarded-for": "5.5.5.5" } }));
    expect(res.status).toBe(503);
  });
  it("a huge or hostile job id is refused cleanly", async () => {
    const res = await savedPost(form("/api/saved", { jobId: "x".repeat(5_000_000), action: "save" }));
    expect(res.headers.get("location")).toContain("code=invalid_input");
    const res2 = await savedPost(form("/api/saved", { jobId: "<script>alert(1)</script>\u0000💥", action: "save" }));
    expect(res2.headers.get("location")).toContain("code=not_found");
  });
  it("a hostile alert location is stored as short plain text and nothing else breaks", async () => {
    await alertsPost(form("/api/alerts", { action: "add", field: "support", country: "US", location: "<b>" + "é💥".repeat(500) }));
    const rule = (await db.listAlertRules("org-a"))[0]!;
    expect(rule.location.length).toBeLessThanOrEqual(60);
  });
  it("double submit of Save is idempotent: one slot used", async () => {
    await Promise.all([1, 2, 3].map(() => savedPost(form("/api/saved", { jobId: jobIds[0]!, action: "save" }))));
    expect(await db.getUsage("org-a", "saves", "all")).toBe(1);
    expect(await db.listSaved("org-a")).toHaveLength(1);
  });
  it("concurrent Apply on the same job costs one open", async () => {
    const id = jobIds[0]!;
    await Promise.all([1, 2, 3, 4].map(() => openPost(jsonReq(`/api/jobs/${id}/open`, {}), { params: Promise.resolve({ id }) })));
    const day = new Date().toISOString().slice(0, 10);
    expect(await db.getUsage("org-a", "opens", day)).toBe(1);
  });
  it("problem pages keep only same-site back paths", () => {
    expect(problemRedirect("rate_limited", "//evil.test").headers.get("location")).toContain("back=%2F");
    expect(problemRedirect("rate_limited", "https://evil.test").headers.get("location")).toContain("back=%2F");
    expect(problemRedirect("nonsense", "/saved").headers.get("location")).toContain("code=server_error");
    for (const p of Object.values(PROBLEMS)) expect(p.body.length).toBeGreaterThan(20);
  });
});

describe("helpers", () => {
  it("csv defuses spreadsheet formulas and quotes", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+1")).toBe(`"'+1"`);
    expect(csvCell("a\nb")).toBe('"a b"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell("Zoë, \"Ltd\" 💥")).toBe('"Zoë, ""Ltd"" 💥"');
    expect(toCsv([["a", "b"]]).startsWith("﻿")).toBe(true);
  });
  it("first run checklist follows what the person has done", () => {
    const none = firstRunSteps({ hasProfile: false, saved: 0, digestOn: true, alertRules: 0, opensToday: 0 });
    expect(none.map((s) => s.done)).toEqual([false, false, false, false]);
    const all = firstRunSteps({ hasProfile: true, saved: 2, digestOn: false, alertRules: 1, opensToday: 1 });
    expect(all.every((s) => s.done)).toBe(true);
  });
  it("logs never carry addresses or long tokens, even inside messages", () => {
    const out = scrub({ message: "send to lee@example.com failed token abcdefghijklmnopqrstuvwxyz0123456789ABCD", email: "x@y.test" });
    expect(JSON.stringify(out)).not.toContain("lee@example.com");
    expect(JSON.stringify(out)).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(out.email).toBe("[redacted]");
  });
});

describe("health route reports dependency state without details", () => {
  it("up/down words only, and nothing from the error text", async () => {
    const { GET } = await import("@/app/api/health/route");
    const up = await (await GET()).json();
    expect(up.db).toBe("up");
    getDbImpl = async () => { throw new Error("connect ECONNREFUSED 10.1.2.3:27017 mongodb+srv://user:pw@host"); };
    const res = await GET();
    expect(res.status).toBe(503);
    const body = JSON.stringify(await res.json());
    expect(body).not.toMatch(/ECONNREFUSED|mongodb|10\.1|pw@/);
    expect(JSON.parse(body).db).toBe("down");
  });
});
