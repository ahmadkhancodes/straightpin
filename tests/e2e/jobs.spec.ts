import { expect, test } from "@playwright/test";

test("landing counter digits flip, and not with reduced motion", async ({ page, browser }) => {
  await page.goto("/");
  const digit = page.locator(".digit-flip").first();
  await expect(digit).toBeVisible();
  expect(await digit.evaluate((e) => getComputedStyle(e).animationName)).toBe("digit-flip");
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const calm = await ctx.newPage();
  await calm.goto("/");
  expect(await calm.locator(".digit-flip").first().evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
  await ctx.close();
});

test("quiz -> matches -> job detail, with live counts, tags and the employer link", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  expect((await request.post("/api/dev/seed-jobs")).ok()).toBeTruthy();

  await page.goto("/quiz");
  const count = page.getByTestId("live-count");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("kind of work");
  const before = Number((await count.locator("b").innerText()).replace(/,/g, ""));
  expect(before).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Customer support", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Where do you want to work");
  const afterField = Number((await count.locator("b").innerText()).replace(/,/g, ""));
  expect(afterField).toBeGreaterThan(0);
  expect(afterField).toBeLessThanOrEqual(before);
  await page.getByRole("button", { name: "United States" }).click();
  await page.getByRole("button", { name: "Anywhere, on site is fine" }).click();
  await page.getByRole("button", { name: "Any pay" }).click();
  await page.getByRole("button", { name: "Show every level" }).click();
  await page.getByRole("button", { name: "Either" }).click();

  await expect(page).toHaveURL(/\/matches\?/);
  await expect(page.getByTestId("match-count")).toContainText("direct");
  await expect(page.getByText("We removed 1 staffing agency post from this list.")).toBeVisible();
  await expect(page.getByText("Direct to company").first()).toBeVisible();
  await expect(page.getByText("Old posting").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await expect(page.getByText("Harbor Staffing Partners")).toHaveCount(0);

  await page.getByRole("link", { name: "Customer Support Specialist" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Customer Support Specialist");
  await expect(page.getByText("First posted by the company")).toBeVisible();
  await expect(page.getByText("boards.greenhouse.io").first()).toBeVisible();
  const apply = page.locator("article");
  await expect(apply.getByRole("button", { name: /Apply at company/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  // signed out: the open goes to sign in, not to the employer
  const id = page.url().split("/job/")[1]!;
  const res = await request.post(`/api/jobs/${id}/open`, { headers: { origin: "http://localhost:3100" }, maxRedirects: 0 });
  expect(res.status()).toBe(303);
  expect(res.headers().location).toContain("/sign-in");
});

test("counts API answers fast and never negative; zero results offer to relax the last answer", async ({ page, request }) => {
  await request.post("/api/dev/seed-jobs");
  const t = Date.now();
  const r = await (await request.get("/api/counts?field=support&country=US")).json();
  expect(Date.now() - t).toBeLessThan(2000);
  expect(r.count).toBeGreaterThanOrEqual(0);
  await page.goto("/quiz?field=marketing&country=CA");
  await expect(page.getByTestId("live-count")).toContainText("0 direct matches");
  await expect(page.getByRole("link", { name: "Change your last answer" })).toBeVisible();
});
