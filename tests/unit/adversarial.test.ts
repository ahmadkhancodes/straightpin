import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Adversarial review, 12 Nov 2026 (docs/SECURITY-REVIEW.md). Each case is an attack that worked, or would have
 * worked, before the fix. Runs the real Better Auth handler on the memory driver with the console outbox.
 */
const BASE = "http://localhost:3000";

describe("auth surface: two users in two organizations", () => {
  let ip = 0;
  let auth: Awaited<ReturnType<typeof import("@/lib/auth")["getAuth"]>>;
  let outbox: { to: string; text: string }[];

  beforeEach(async () => {
    vi.stubEnv("DB_DRIVER", "memory");
    vi.stubEnv("MAIL_PROVIDER", "console");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", BASE);
    globalThis.__kitAuth = undefined;
    globalThis.__kitAuthMemory = undefined;
    vi.resetModules();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    auth = await (await import("@/lib/auth")).getAuth();
    outbox = (await import("@/lib/mail/transports")).outbox;
    outbox.length = 0;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    globalThis.__kitAuth = undefined;
    globalThis.__kitAuthMemory = undefined;
  });

  const call = async (path: string, method: string, body?: unknown, cookie = "") => {
    const r = await auth.handler(
      new Request(`${BASE}/api/auth${path}`, {
        method,
        headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}), "x-forwarded-for": `10.0.0.${++ip % 250}` },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
    const text = await r.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, data };
  };

  const linkFor = (email: string) => new URL(outbox.filter((m) => m.to === email).at(-1)!.text.match(/https?:\/\/\S+/)![0]);

  const signIn = async (email: string) => {
    expect((await call("/sign-in/magic-link", "POST", { email, callbackURL: "/app" })).status).toBe(200);
    const u = linkFor(email);
    const r = await auth.handler(new Request(`${BASE}${u.pathname}${u.search}`, { headers: { "x-forwarded-for": `10.1.0.${++ip % 250}` } }));
    return { cookie: r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "), link: `${u.pathname}${u.search}` };
  };

  it("another organization's data, settings and API keys stay closed", async () => {
    const A = await signIn("a@a.test");
    const B = await signIn("b@b.test");
    const oa = (await call("/organization/create", "POST", { name: "A", slug: "a-org" }, A.cookie)).data as { id: string };
    expect((await call("/organization/create", "POST", { name: "B", slug: "b-org" }, B.cookie)).status).toBe(200);
    expect((await call(`/organization/get-full-organization?organizationId=${oa.id}`, "GET", undefined, B.cookie)).status).toBe(403);
    expect((await call("/organization/set-active", "POST", { organizationId: oa.id }, B.cookie)).status).toBe(403);
    expect((await call("/organization/update", "POST", { organizationId: oa.id, data: { name: "pwn" } }, B.cookie)).status).toBeGreaterThanOrEqual(400);
    expect((await call("/organization/delete", "POST", { organizationId: oa.id }, B.cookie)).status).toBeGreaterThanOrEqual(400);
    expect((await call("/api-key/create", "POST", { name: "x", organizationId: oa.id }, B.cookie)).status).toBe(403);
    expect((await call(`/api-key/list?organizationId=${oa.id}`, "GET", undefined, B.cookie)).status).toBe(403);
    expect((await call(`/organization/list-invitations?organizationId=${oa.id}`, "GET", undefined, B.cookie)).status).toBe(403);
    // Email is the founder check (ADMIN_EMAILS): it can never be changed from the client.
    expect((await call("/update-user", "POST", { email: "founder@x.test" }, B.cookie)).status).toBe(400);
    expect((await call("/change-email", "POST", { newEmail: "founder@x.test" }, B.cookie)).status).toBe(400);
  });

  it("SEC-2: a paying owner cannot share the plan by inviting people (and no invite email goes out)", async () => {
    const A = await signIn("a@a.test");
    const C = await signIn("c@c.test");
    const oa = (await call("/organization/create", "POST", { name: "Click evil.example to claim", slug: "a-org" }, A.cookie)).data as { id: string };
    outbox.length = 0;
    const inv = await call("/organization/invite-member", "POST", { organizationId: oa.id, email: "c@c.test", role: "member" }, A.cookie);
    expect(inv.status).toBe(403);
    expect(outbox.filter((m) => m.to === "c@c.test")).toEqual([]);
    const list = (await auth.api.listOrganizations({ headers: new Headers({ cookie: C.cookie }) })) as unknown[];
    expect(list).toEqual([]);
  });

  it("SEC-3: one organization per person, so free limits cannot be reset with a fresh organization", async () => {
    const B = await signIn("b@b.test");
    expect((await call("/organization/create", "POST", { name: "B", slug: "b-org" }, B.cookie)).status).toBe(200);
    expect((await call("/organization/create", "POST", { name: "B2", slug: "b2-org" }, B.cookie)).status).toBe(403);
  });

  it("SEC-4: sign-in refuses callback URLs on other sites, even under NODE_ENV=test", async () => {
    for (const cb of ["https://evil.example/x", "//evil.example/x", "/\\evil.example", "http://localhost:3000.evil.example/"]) {
      const r = await call("/sign-in/magic-link", "POST", { email: "d@d.test", callbackURL: cb });
      expect(r.status, cb).toBe(403);
      for (const k of ["errorCallbackURL", "newUserCallbackURL"])
        expect((await call("/sign-in/magic-link", "POST", { email: "d@d.test", callbackURL: "/app", [k]: cb })).status, `${k} ${cb}`).toBe(403);
    }
    expect(outbox.filter((m) => m.to === "d@d.test")).toEqual([]);
    // A real link with its callbackURL swapped for another site is refused, not followed.
    await call("/sign-in/magic-link", "POST", { email: "e@e.test", callbackURL: "/app" });
    const u = linkFor("e@e.test");
    u.searchParams.set("callbackURL", "https://evil.example/");
    const v = await auth.handler(new Request(`${BASE}${u.pathname}${u.search}`));
    expect(v.headers.get("location") ?? "").not.toContain("evil.example");
  });

  it("a magic link works once; a replay does not sign in", async () => {
    const A = await signIn("a@a.test");
    const again = await auth.handler(new Request(`${BASE}${A.link}`));
    expect(again.headers.get("location")).toContain("error=");
    expect(again.headers.getSetCookie().some((c) => /session_token=[^;]+/.test(c) && !/session_token=;/.test(c))).toBe(false);
  });
});

describe("SEC-5: redirect targets cannot leave the site", () => {
  it("tab, newline and backslash tricks fall back", async () => {
    const { isSafePath } = await import("@/lib/security/safe-url");
    const { safeNext } = await import("@/components/app/redirect");
    const { problemRedirect } = await import("@/lib/security/guard");
    for (const bad of ["/\t/evil.example", "/\n/evil.example", "/\r\n/evil.example", "/\\evil.example", "//evil.example", "https://evil.example", "/%09/ok-encoded-is-fine-but-not-here\u0000"]) {
      expect(isSafePath(bad), JSON.stringify(bad)).toBe(false);
      expect(safeNext(bad)).toBe("/app");
      const loc = problemRedirect("server_error", bad).headers.get("location")!;
      expect(new URL(loc).searchParams.get("back")).toBe("/");
    }
    for (const good of ["/app", "/job/abc?x=1", "/matches?location=New York", "/onboarding?next=%2Fjob%2F1"]) expect(isSafePath(good), good).toBe(true);
  });
});

describe("SEC-6: crawled apply links must be http(s)", () => {
  it("javascript: and data: links from a board are dropped at ingest", async () => {
    const { buildJob } = await import("@/lib/crawl/adapters/common");
    const base = { ats: "greenhouse" as const, externalId: "1", title: "Support Specialist", country: "US" as const, location: "Remote", descriptionText: "" };
    for (const bad of ["javascript://example.com/%0Aalert(document.cookie)", "JaVaScRiPt://example.com/%0Aalert(1)", "data://example.com/text/html,<script>1</script>", "ftp://example.com/x"])
      expect(buildJob({ ...base, applyUrl: bad } as never), bad).toBeNull();
    expect(buildJob({ ...base, applyUrl: "https://boards.example.com/jobs/1" } as never)?.applyUrl).toBe("https://boards.example.com/jobs/1");
  });
});

describe("SEC-7: the crawler cannot be steered at internal addresses or swamped by a huge answer", () => {
  it("host names that resolve to private, loopback, link-local or multicast addresses are refused before connecting", async () => {
    const { assertPublicHost, httpTransport } = await import("@/lib/jobs/transport");
    const dns = (addr: string) => async () => [{ address: addr }];
    for (const a of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.0.10", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1", "0.0.0.0"])
      await expect(assertPublicHost("https://careers.example.com/sitemap.xml", dns(a)), a).rejects.toThrow(/egress blocked/);
    await expect(assertPublicHost("https://careers.example.com/", async () => [{ address: "93.184.216.34" }, { address: "10.0.0.1" }])).rejects.toThrow(/egress blocked/);
    await expect(assertPublicHost("https://careers.example.com/", async () => [])).rejects.toThrow(/egress blocked/);
    await expect(assertPublicHost("https://careers.example.com/", dns("93.184.216.34"))).resolves.toBeUndefined();
    // The transport checks before any request leaves.
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await expect(httpTransport(1000, dns("169.254.169.254"))("https://rebind.example.com/", {})).rejects.toThrow(/egress blocked/);
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("a body larger than the cap is cut off while streaming", async () => {
    const { readCapped } = await import("@/lib/jobs/transport");
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        pulled++;
        if (pulled > 10_000) return c.close();
        c.enqueue(new Uint8Array(64 * 1024).fill(97));
      },
    });
    const body = await readCapped(new Response(stream), 200_000);
    expect(body.length).toBe(200_000);
    expect(pulled).toBeLessThan(10);
  });
});

describe("SEC-8: the E2E outbox never opens on a deployment", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("E2E_OUTBOX=1 set by mistake on Vercel still answers 404, so sign-in links cannot be read", async () => {
    const { GET } = await import("@/app/api/dev/outbox/route");
    const { POST } = await import("@/app/api/dev/seed-jobs/route");
    vi.stubEnv("E2E_OUTBOX", "1");
    vi.stubEnv("VERCEL", "1");
    expect((await GET(new Request(`${BASE}/api/dev/outbox?to=a@a.test`))).status).toBe(404);
    expect((await POST(new Request(`${BASE}/api/dev/seed-jobs`, { method: "POST" }))).status).toBe(404);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await GET(new Request(`${BASE}/api/dev/outbox`))).status).toBe(404);
  });
});
