import { describe, expect, it } from "vitest";
import { createMemoryDb } from "@/lib/db/memory";
import { assertSameOrigin, HttpError, readJson, withApi } from "@/lib/http";
import { rateLimit } from "@/lib/security/ratelimit";
import { isDisposableEmail, normEmail } from "@/lib/security/disposable";
import { newChallenge, verifyAltcha } from "@/lib/security/altcha";
import { defaultConsent, regionOf } from "@/lib/consent";
import { envFlags } from "@/lib/env";
import { securityHeaders } from "@/lib/security/headers";
import { z } from "zod";
import { solveChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";

const post = (headers: Record<string, string>) => new Request("https://app.test/api/x", { method: "POST", headers });

describe("CSRF origin check", () => {
  const origins = ["https://app.test"];
  it("allows same origin and GET", () => {
    expect(() => assertSameOrigin(post({ origin: "https://app.test" }), origins)).not.toThrow();
    expect(() => assertSameOrigin(new Request("https://app.test/x"), origins)).not.toThrow();
  });
  it("rejects a foreign or missing Origin on POST", () => {
    expect(() => assertSameOrigin(post({ origin: "https://evil.test" }), origins)).toThrow(HttpError);
    expect(() => assertSameOrigin(post({}), origins)).toThrow("bad_origin");
  });
  it("API-key requests are not cookie driven and pass", () => {
    expect(() => assertSameOrigin(post({ "x-api-key": "k" }), origins)).not.toThrow();
  });
  it("withApi maps HttpError to JSON and hides internals", async () => {
    const h = withApi(async () => { throw new Error("db password leaked?"); }, { csrf: false });
    const r = await h(new Request("https://app.test/x"), undefined);
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "server_error" });
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
  it("readJson validates with zod and rejects bad JSON", async () => {
    await expect(readJson(new Request("https://a.test", { method: "POST", body: "{nope" }))).rejects.toMatchObject({ code: "bad_json" });
    await expect(readJson(new Request("https://a.test", { method: "POST", body: '{"n":"x"}' }), z.object({ n: z.number() }))).rejects.toMatchObject({ code: "invalid_input" });
  });
});

describe("rate limiter", () => {
  it("blocks after the limit inside the window, then recovers", async () => {
    const db = createMemoryDb("postslot");
    const rule = { limit: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i++) expect((await rateLimit("k", rule, db, 1000 + i)).ok).toBe(true);
    expect((await rateLimit("k", rule, db, 1010)).ok).toBe(false);
    expect((await rateLimit("k", rule, db, 1000 + 61_000 + 10)).ok).toBe(true);
  });
});

describe("abuse helpers", () => {
  it("disposable domains and subdomains are caught; emails normalised", () => {
    expect(isDisposableEmail("a@mailinator.com")).toBe(true);
    expect(isDisposableEmail("a@x.yopmail.com")).toBe(true);
    expect(isDisposableEmail("a@studio.co.uk")).toBe(false);
    expect(normEmail("  Dana@Studio.TEST ")).toBe("dana@studio.test");
    expect(normEmail("nope")).toBeNull();
  });
  it("ALTCHA: a solved challenge verifies once; replays and garbage fail", async () => {
    const db = createMemoryDb("postslot");
    const challenge = await newChallenge();
    const solution = await solveChallenge({ challenge, deriveKey } as never);
    expect(solution).toBeTruthy();
    const payload = btoa(JSON.stringify({ challenge, solution }));
    expect(await verifyAltcha(payload, db)).toBe(true);
    expect(await verifyAltcha(payload, db)).toBe(false);
    expect(await verifyAltcha("garbage", db)).toBe(false);
  }, 30_000);
});

describe("consent + flags + headers", () => {
  it("opt-in regions default off, others on, unknown off (D44)", () => {
    expect(defaultConsent("GB")).toBe(false);
    expect(defaultConsent("US")).toBe(true);
    expect(defaultConsent(null)).toBe(false);
    expect(regionOf(new Headers({ "accept-language": "en-GB,en;q=0.9" }))).toBe("GB");
    expect(regionOf(new Headers({ "x-vercel-ip-country": "ca" }))).toBe("CA");
  });
  it("APP_FLAGS keeps string values; bad JSON ignored (D45)", () => {
    expect(envFlags({ APP_FLAGS: '{"payments_enabled":"off","n":1}' })).toEqual({ payments_enabled: "off" });
    expect(envFlags({ APP_FLAGS: "{bad" })).toEqual({});
  });
  it("security headers include CSP, HSTS, frame-ancestors none", () => {
    const h = Object.fromEntries(securityHeaders().map((x) => [x.key, x.value]));
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(h["Strict-Transport-Security"]).toContain("max-age");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
  });
});
