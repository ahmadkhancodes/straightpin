import { expect, test } from "@playwright/test";

const OUT = "docs/qa/m4";

test("programmatic job pages, the /jobs index and /about/data at 375", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  expect((await request.post("/api/dev/seed-jobs?pages=1")).ok()).toBeTruthy();

  await page.goto("/jobs");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Jobs direct from company");
  await expect(page.getByRole("link", { name: /Toronto · 10/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/jobs-index-375.png`, fullPage: true });

  await page.getByRole("link", { name: /Toronto · 10/ }).first().click();
  await expect(page).toHaveURL(/\/jobs\/support\/toronto$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Customer support jobs in Toronto");
  await expect(page.locator("article")).toHaveCount(10);
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(/\/jobs\/support\/toronto$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: `${OUT}/jobs-support-toronto-375.png`, fullPage: true });

  // below the minimum there is no page
  expect((await page.goto("/jobs/finance/toronto"))!.status()).toBe(404);
  expect((await page.goto("/jobs/juggling/toronto"))!.status()).toBe(404);

  // the sitemap lists the qualifying pages only
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/jobs/support/toronto");
  expect(sitemap).not.toContain("/jobs/finance/toronto");

  await page.goto("/about/data");
  await expect(page.getByText(/we keep the closed job for 90 days/)).toBeVisible();
  await expect(page.getByText(/deleted after 30 days/)).toBeVisible();
  await page.screenshot({ path: `${OUT}/about-data-375.png`, fullPage: true });
});

test("a job page carries JobPosting JSON-LD that links to the employer", async ({ page, request }) => {
  expect((await request.post("/api/dev/seed-jobs?pages=1")).ok()).toBeTruthy();
  await page.goto("/jobs/support/toronto");
  await page.locator("article a").first().click();
  await page.waitForURL(/\/job\/[0-9a-f]{20}$/);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
  expect(ld["@type"]).toBe("JobPosting");
  expect(ld.url).toMatch(/^https:\/\/boards\.greenhouse\.io\//);
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(/\/job\/[0-9a-f]{20}$/);
  expect(await page.locator('meta[name="robots"]').count()).toBe(0);
});

test("the manage alerts page rejects a bad link without touching data", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/alerts/manage?e=a%40b.test&t=bad");
  await expect(page.getByText("This link is not valid")).toBeVisible();
  await page.screenshot({ path: `${OUT}/alerts-manage-invalid-375.png`, fullPage: true });
});
