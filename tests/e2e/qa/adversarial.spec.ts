import { expect, test, type Page } from "@playwright/test";
import { ORIGIN, ownIp, signInViaUi } from "./helpers";

/**
 * Adversarial review (docs/SECURITY-REVIEW.md), against the production build: two people in two organizations try
 * each other's data, the auth plugin endpoints, open redirects and session replay.
 */
const json = { origin: ORIGIN, "content-type": "application/json" };
const orgsOf = async (page: Page) => (await (await page.request.get("/api/auth/organization/list")).json()) as { id: string }[];

test("tenant isolation and plan sharing through the auth plugin endpoints", async ({ browser, request }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await signInViaUi(a, request);
  const bEmail = await signInViaUi(b, request);
  const [orgA] = await orgsOf(a);
  const [orgB] = await orgsOf(b);
  expect(orgA?.id && orgB?.id && orgA.id !== orgB.id).toBeTruthy();

  // B reads, joins, edits or deletes A's organization
  expect((await b.request.get(`/api/auth/organization/get-full-organization?organizationId=${orgA!.id}`)).status()).toBe(403);
  expect((await b.request.post("/api/auth/organization/set-active", { headers: json, data: { organizationId: orgA!.id } })).status()).toBe(403);
  expect((await b.request.post("/api/auth/organization/update", { headers: json, data: { organizationId: orgA!.id, data: { name: "pwn" } } })).status()).toBeGreaterThanOrEqual(400);
  expect((await b.request.post("/api/auth/organization/delete", { headers: json, data: { organizationId: orgA!.id } })).status()).toBeGreaterThanOrEqual(400);
  expect((await b.request.post("/api/auth/api-key/create", { headers: json, data: { name: "x", organizationId: orgA!.id } })).status()).toBe(403);
  expect((await orgsOf(a)).length).toBe(1);

  // A (who could hold a paid plan) invites B to share it: refused, and no invitation mail goes out
  const inv = await a.request.post("/api/auth/organization/invite-member", { headers: json, data: { organizationId: orgA!.id, email: bEmail, role: "member" } });
  expect(inv.status()).toBe(403);
  const box = await (await request.get(`/api/dev/outbox?to=${encodeURIComponent(bEmail)}`)).json();
  expect(box.messages.every((m: { subject: string }) => !/join|invit/i.test(m.subject))).toBe(true);

  // B makes a second organization to get fresh free limits: refused
  expect((await b.request.post("/api/auth/organization/create", { headers: json, data: { name: "Fresh", slug: `fresh-${Date.now()}` } })).status()).toBe(403);
  expect((await orgsOf(b)).length).toBe(1);

  // Founder-only area and actions stay hidden from a normal account
  expect((await b.request.post("/api/admin/users", { headers: { origin: ORIGIN }, form: { orgId: orgA!.id, email: "x@x.test", action: "suspend" }, maxRedirects: 0 })).status()).toBe(404);
  expect((await b.goto("/admin"))?.status()).toBe(404);
});

test("sign-in refuses callback URLs on other sites", async ({ page }) => {
  await ownIp(page);
  for (const cb of ["https://evil.example/", "//evil.example/", "/\\evil.example"]) {
    const r = await page.request.post("/api/auth/sign-in/magic-link", { headers: json, data: { email: `x${Date.now()}@studio.test`, callbackURL: cb } });
    expect(r.status(), cb).toBe(403);
  }
});

test("redirect targets with a tab or newline stay on this site", async ({ page, request, context }) => {
  await context.route((u) => u.hostname.endsWith("evil.example"), (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>evil</title>evil" }));
  await signInViaUi(page, request);
  for (const next of ["/\t/evil.example/", "/\n/evil.example/", "/\\evil.example/"]) {
    await page.goto(`/onboarding?next=${encodeURIComponent(next)}`);
    expect(new URL(page.url()).host, JSON.stringify(next)).toBe(new URL(ORIGIN).host);
    await page.goto(`/problem?code=server_error&back=${encodeURIComponent(next)}`);
    const href = await page.getByRole("link", { name: "Go back" }).getAttribute("href");
    expect(new URL(href!, ORIGIN).host, JSON.stringify(next)).toBe(new URL(ORIGIN).host);
  }
});

test("session cookie flags, and a signed-out session cannot be replayed", async ({ page, request, playwright }) => {
  await signInViaUi(page, request);
  const cookies = await page.context().cookies();
  const token = cookies.find((c) => c.name.endsWith("session_token"));
  expect(token?.httpOnly).toBe(true);
  expect(token?.sameSite).toBe("Lax");
  const header = `${token!.name}=${token!.value}`;
  const fresh = await playwright.request.newContext({ baseURL: ORIGIN });
  expect(await (await fresh.get("/api/auth/get-session", { headers: { cookie: header } })).json()).not.toBeNull();
  expect((await page.request.post("/api/auth/sign-out", { headers: json, data: {} })).ok()).toBe(true);
  expect(await (await fresh.get("/api/auth/get-session", { headers: { cookie: header } })).json()).toBeNull();
  expect((await fresh.get("/api/saved/export", { headers: { cookie: header }, maxRedirects: 0 })).status()).toBe(303);
  await fresh.dispose();
});

test("errors and health answer without internals", async ({ request }) => {
  const health = await (await request.get("/api/health")).text();
  expect(health).not.toMatch(/mongodb|stack|Error:|node_modules|\/home\//i);
  for (const [path, init] of [
    ["/api/profile", { headers: json, data: "{not json" }],
    ["/api/saved", { headers: json, data: { jobId: { $ne: "" } } }],
    ["/api/jobs/%7B%22%24ne%22%3A1%7D/open", { headers: { origin: ORIGIN, accept: "application/json" } }],
  ] as const) {
    const r = await request.post(path, init as never);
    expect(r.status(), path).toBeLessThan(500);
    expect(await r.text(), path).not.toMatch(/at \w+ \(|node_modules|\/home\/|stack/i);
  }
});
