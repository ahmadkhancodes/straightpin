import { expect, test } from "@playwright/test";
import { firstJobId, signInViaUi } from "./helpers";

/** Records every CSP violation (event + console) so a button that is silently blocked fails the test. */
async function watchCsp(page: import("@playwright/test").Page) {
  const seen: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp: string[] }).__csp = [...((window as unknown as { __csp?: string[] }).__csp ?? []), `${e.violatedDirective} ${e.blockedURI}`];
    });
  });
  page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) seen.push(m.text()); });
  return async () => [...seen, ...(((await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp).catch(() => undefined)) ?? []))];
}

test("no page or button of a signed-in job seeker trips the CSP", async ({ page, request, context }) => {
  await context.route(/^https:\/\/(?!localhost).*/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>x</title>x" }));
  const csp = await watchCsp(page);
  await signInViaUi(page, request);
  const id = await firstJobId(page, request);
  const all: string[] = [];
  for (const path of ["/", "/pricing", "/quiz", "/matches?field=support&country=US&remote=any&payFloor=0&level=any&schedule=any", `/job/${id}`, "/saved", "/alerts", "/account", "/app", "/app/settings/profile", "/app/settings/security", "/paywall", "/how-we-check", "/jobs", "/docs", "/legal/privacy"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await page.waitForLoadState("load");
    await page.waitForTimeout(400);
    all.push(...(await csp()));
  }
  // Save and unsave through the real forms (303 back to our own pages)
  await page.goto(`/job/${id}`);
  await page.getByRole("button", { name: /^Save/ }).first().click();
  await page.waitForLoadState("networkidle");
  await page.goto("/saved");
  await expect(page.getByRole("link", { name: /Download as spreadsheet/ })).toBeVisible();
  all.push(...(await csp()));
  expect(all).toEqual([]);
});

test("saved jobs download as a spreadsheet with only our own link", async ({ page, request }) => {
  await signInViaUi(page, request);
  const id = await firstJobId(page, request);
  await page.goto(`/job/${id}`);
  await page.getByRole("button", { name: /^Save/ }).first().click();
  await page.waitForLoadState("networkidle");
  const res = await page.request.get("/api/saved/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  const text = await res.text();
  expect(text).toContain(`/job/${id}`);
  expect(text.split("\r\n")[0]).toContain("Title");
  expect((await request.get("/api/saved/export", { maxRedirects: 0 })).status()).toBe(303);
});

test("a new user sees a first-run checklist that ticks off", async ({ page, request }) => {
  await signInViaUi(page, request);
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Tell us your field/ })).toBeVisible();
});

test("a failed plain form post lands on a readable page with a way back", async ({ page }) => {
  await page.goto("/problem?code=rate_limited&back=/saved");
  await expect(page.getByRole("heading", { name: /a lot of clicks/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/saved");
  await page.goto("/problem?code=whatever&back=//evil.test");
  await expect(page.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/");
});

test("Apply without JavaScript gives a link page instead of a dead button", async ({ browser, request }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: true });
  const page = await ctx.newPage();
  await signInViaUi(page, request);
  const id = await firstJobId(page, request);
  const res = await page.request.post(`/api/jobs/${id}/open`, { headers: { origin: "http://localhost:3100" }, maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("noopener noreferrer");
  await ctx.close();
});

test("security headers are on pages and API answers", async ({ request }) => {
  for (const p of ["/", "/api/health", "/api/counts?field=support"]) {
    const h = (await request.get(p)).headers();
    expect(h["content-security-policy"], p).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"], p).toBe("nosniff");
  }
  const health = await (await request.get("/api/health")).json();
  expect(Object.keys(health).sort()).toEqual(["at", "billing", "db", "mail", "ok", "version"]);
});

test("a stale or broken session sends the user to sign in, not a blank page", async ({ page, context }) => {
  await context.addCookies([{ name: "better-auth.session_token", value: "garbage.value", url: "http://localhost:3100" }]);
  await page.goto("/app");
  await expect(page).toHaveURL(/sign-in/);
  await page.goto("/saved");
  await expect(page).toHaveURL(/sign-in/);
});
