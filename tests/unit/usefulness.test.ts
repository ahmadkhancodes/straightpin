import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { cookies as cookiePolicy } from "@/content/legal/cookies";
import { resetPhrase } from "@/lib/jobs/format";
import { ANSWERS_COOKIE, answersFromCookie, answersQuery, matchScore, optionLabel, QUIZ_STEPS } from "@/lib/jobs/matching";
import type { JobDoc } from "@/lib/jobs/types";
import { rememberAnswers } from "@/proxy";

const FULL = "field=support&country=UK&remote=any&payFloor=15&level=entry&schedule=any";

describe("remembered quiz answers (sp_q)", () => {
  it("a /matches visit with a full, valid set stores only the six answers, httpOnly, for 30 days", () => {
    const req = new NextRequest(`http://localhost/matches?${FULL}&page=2&utm_source=x`);
    const res = rememberAnswers(req, NextResponse.next());
    const c = res.cookies.get(ANSWERS_COOKIE)!;
    expect(c.value).toBe(FULL);
    expect(c.httpOnly).toBe(true);
    expect(c.sameSite).toBe("lax");
    expect(c.maxAge).toBe(60 * 60 * 24 * 30);
  });

  it("partial, invalid or other pages store nothing", () => {
    for (const url of ["http://localhost/matches?field=support", "http://localhost/matches?field=<x>&country=US&remote=any&payFloor=0&level=any&schedule=any", `http://localhost/quiz?${FULL}`, `http://localhost/job/abc?${FULL}`]) {
      expect(rememberAnswers(new NextRequest(url), NextResponse.next()).cookies.get(ANSWERS_COOKIE), url).toBeUndefined();
    }
  });

  it("reading the cookie back validates it and rebuilds the same query", () => {
    const a = answersFromCookie(FULL)!;
    expect(a).toMatchObject({ field: "support", country: "UK", payFloor: 15 });
    expect(answersQuery(a)).toBe(FULL);
    expect(answersFromCookie(undefined)).toBeUndefined();
    expect(answersFromCookie("field=support")).toBeUndefined();
    expect(answersFromCookie("x".repeat(400))).toBeUndefined();
  });

  it("the cookie policy lists it", () => {
    expect(JSON.stringify(cookiePolicy)).toMatch(/last quiz answers/);
  });

  it("/matches falls back to the remembered answers before sending people back to the quiz", () => {
    const src = readFileSync("src/app/(jobs)/matches/page.tsx", "utf8");
    expect(src).toMatch(/answersFromCookie\(\(await cookies\(\)\)\.get\(ANSWERS_COOKIE\)/);
  });
});

describe("pay in the person's own currency", () => {
  const pay = QUIZ_STEPS.find((s) => s.key === "payFloor")!.options[1]!;
  it("quiz and filter labels use $, C$ or £ by country", () => {
    expect(optionLabel("payFloor", pay.label, "US")).toBe("$15 an hour or more");
    expect(optionLabel("payFloor", pay.label, "CA")).toBe("C$15 an hour or more");
    expect(optionLabel("payFloor", pay.label, "UK")).toBe("£15 an hour or more");
    expect(optionLabel("payFloor", pay.label, undefined)).toBe("$15 an hour or more");
    expect(optionLabel("remote", "Remote only", "UK")).toBe("Remote only");
  });

  it("the match reason uses the job's currency (a UK salary is never shown in dollars)", () => {
    const job = { remoteType: "onsite", payHourlyMax: 12.4, currency: "GBP", country: "UK", level: "entry", schedule: "full", firstPublishedAt: null, ghostScore: 0 } as unknown as JobDoc;
    const answers = { field: "admin", country: "UK", remote: "any", payFloor: 0, level: "any", schedule: "any" } as const;
    expect(matchScore(job, answers, new Date()).reason).toBe("Pays up to £12 an hour");
    expect(matchScore({ ...job, currency: "CAD", country: "CA" } as JobDoc, { ...answers, country: "CA" }, new Date()).reason).toBe("Pays up to C$12 an hour");
    expect(matchScore({ ...job, currency: null, country: "UK" } as JobDoc, answers, new Date()).reason).toBe("Pays up to £12 an hour");
  });
});

describe("daily limit reset in words", () => {
  it("counts the hours to the next UTC midnight", () => {
    expect(resetPhrase(new Date("2026-11-12T17:00:00Z"))).toBe("in 7 hours (midnight UTC)");
    expect(resetPhrase(new Date("2026-11-12T22:30:00Z"))).toBe("in 1 hour (midnight UTC)");
    expect(resetPhrase(new Date("2026-11-12T23:59:00Z"))).toBe("in under an hour (midnight UTC)");
    expect(resetPhrase(new Date("2026-11-12T00:00:00Z"))).toBe("in 24 hours (midnight UTC)");
  });
});

describe("docs and pricing say what the code does", () => {
  it("each 'Up to N saved alerts' highlight on the pricing table equals the plan's real alertLimit", async () => {
    const { plans } = await import("@/config/product");
    for (const p of plans) {
      const said = p.highlights.map((h) => /Up to (\d+) /.exec(h)?.[1]).find(Boolean);
      if (said) expect(Number(said), p.id).toBe(p.alertLimit);
    }
    expect(plans.find((p) => p.id === "free")!.highlights).toEqual(expect.arrayContaining([`${plans[0]!.limits.opens} job opens a day`, `${plans[0]!.limits.saves} saved jobs`]));
  });

  it("the buttons /docs/billing names are the ones on the Account page", () => {
    const src = readFileSync("src/app/(jobs)/account/account-client.tsx", "utf8");
    for (const label of [">Cancel plan<", ">Refund my first payment<", ">Download my data<", ">Delete my account<"]) expect(src).toContain(label);
  });

  it("Checkout returns to the Account page, which explains both outcomes", () => {
    const route = readFileSync("src/app/api/billing/checkout/route.ts", "utf8");
    expect(route).toContain("success: `${base}/account?checkout=success`");
    expect(route).toContain("cancel: `${base}/account?checkout=canceled`");
    const client = readFileSync("src/app/(jobs)/account/account-client.tsx", "utf8");
    for (const t of ["Thanks, your plan is on", "Turning your plan on", "Your payment is still being confirmed", "Checkout closed"]) expect(client).toContain(t);
  });
});
