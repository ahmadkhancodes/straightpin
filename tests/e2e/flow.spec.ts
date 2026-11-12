import { expect, test } from "@playwright/test";

// End to end on the memory driver: magic link -> session -> org -> entitlement -> API key -> cron guard.
test("magic link sign-in, org, billing state, api key, cron guard", async ({ page, request, baseURL }) => {
  const email = `e2e+${Date.now()}@studio.test`;
  const origin = { origin: baseURL! };

  const start = await page.request.post("/api/auth/sign-in/magic-link", { data: { email, callbackURL: "/app" }, headers: origin });
  expect(start.ok()).toBeTruthy();

  const box = await (await request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`)).json();
  expect(box.messages).toHaveLength(1); // sign-in sends exactly one email to a first-time address
  const link = /https?:\/\/\S+magic-link\/verify\S+/.exec(box.messages.at(-1).text)?.[0];
  expect(link).toBeTruthy();
  await page.goto(link!);

  const session = await (await page.request.get("/api/auth/get-session")).json();
  expect(session.user.email).toBe(email);

  // A returning address gets exactly one more sign-in email.
  const again = await request.post("/api/auth/sign-in/magic-link", { data: { email, callbackURL: "/app" }, headers: origin });
  expect(await again.json()).toEqual({ status: true });
  const box2 = await (await request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`)).json();
  expect(box2.messages).toHaveLength(2);

  // The first sign-in sets up the one personal account by itself (D-058); a second one is refused (D-057).
  const orgs = await (await page.request.get("/api/auth/organization/list")).json();
  expect(orgs).toHaveLength(1);
  expect(orgs[0].name).toBe("My job search");
  const orgId = orgs[0].id;
  const second = await page.request.post("/api/auth/organization/create", { data: { name: "Harbor Studio", slug: `harbor-${Date.now()}` }, headers: origin });
  expect(second.ok()).toBeFalsy();
  await page.request.post("/api/auth/organization/set-active", { data: { organizationId: orgId }, headers: origin });

  const ent = await (await page.request.get("/api/billing/entitlement")).json();
  expect(ent.plan.id).toBe("free");

  // CSRF: a cookie-authenticated POST from a foreign origin is refused
  const csrf = await page.request.post("/api/billing/portal", { headers: { origin: "https://evil.test" } });
  expect(csrf.status()).toBe(403);

  // Stub mode: checkout without Stripe answers 503 billing_unavailable (calm UI notice), never 500
  const co = await page.request.post("/api/billing/checkout", { data: { plan: "monthly", interval: "month" }, headers: origin });
  expect([200, 503]).toContain(co.status());

  // Kit routes that are not part of the product are gone
  for (const gone of ["/api/v1/me", "/api/webhooks", "/api/webhooks/deliveries"]) expect((await request.get(gone)).status(), gone).toBe(404);

  expect((await request.post("/api/cron/heartbeat")).status()).toBe(401);
  expect((await request.post("/api/cron/heartbeat", { headers: { authorization: "Bearer e2e-cron" } })).ok()).toBeTruthy();

  const exp = await page.request.get("/api/account/export");
  expect((await exp.json()).user.email).toBe(email);
});

test("public pages render with metadata and no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/", "/pricing", "/compare/directroles", "/how-we-check", "/docs", "/legal/privacy", "/sign-in", "/quiz", "/matches?field=support&country=US&remote=any&payFloor=0&level=any&schedule=any"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("title")).not.toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
  }
  expect((await page.goto("/nope-404"))?.status()).toBe(404);
  expect((await page.request.get("/api/health")).ok()).toBeTruthy();
  expect(await (await page.request.get("/llms.txt")).text()).toContain("Straightpin");
});

test("landing: price and refund on the first screen, chips update the sample count", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Jobs straight from company careers pages");
  const price = page.getByText("$10.99 a month").first();
  await expect(price).toBeVisible();
  expect((await price.boundingBox())!.y).toBeLessThan(812);
  await expect(page.getByText(/7 day refund/).first()).toBeVisible();
  const chip = page.getByRole("button", { name: /^Data entry/ });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/for Data entry/)).toBeVisible();
  await expect(page.getByText("We removed 63 staffing agency posts from this list.")).toBeVisible();
  for (const el of await page.locator("main a, main button").all()) {
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox();
    if (box && box.height < 44 && (await el.evaluate((n) => getComputedStyle(n).display !== "inline"))) {
      throw new Error(`tap target under 44px: ${await el.innerText()} (${box.height})`);
    }
  }
});

test("pricing lists every plan from product.ts", async ({ page }) => {
  await page.goto("/pricing");
  for (const t of ["$4.99", "$10.99", "$23.99", "$19.99", "$98.99"]) await expect(page.getByText(t).first()).toBeVisible();
  await expect(page.getByText("Pre selected", { exact: true })).toBeVisible();
});
