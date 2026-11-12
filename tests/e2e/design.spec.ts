import { expect, test } from "@playwright/test";
import { signInViaUi } from "./qa/helpers";

// Behaviour added with the "Help Wanted page" redesign (docs/design-brief.md).
const MATCHES = "/matches?field=support&country=US&remote=any&payFloor=0&level=any&schedule=any";

test("matches at 375: filters fold behind one toggle so the list starts on the first screen", async ({ page, request }) => {
  await request.post("/api/dev/seed-jobs");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(MATCHES);
  const field = page.locator('select[name="field"]');
  await expect(field).toBeHidden();
  const toggle = page.locator('label[for="refine-toggle"]');
  expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await toggle.click();
  await expect(field).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(MATCHES);
  await expect(page.locator('select[name="field"]')).toBeVisible();
});

test("job page at 375: Apply at company stays on screen while reading", async ({ page, request }) => {
  await request.post("/api/dev/seed-jobs");
  await page.goto(MATCHES);
  const href = await page.getByRole("link", { name: "Customer Support Specialist" }).first().getAttribute("href");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(href!);
  await expect(page.getByRole("button", { name: /Apply at company/ })).toBeInViewport();
});

test("header says Account, not Log in, once signed in", async ({ page, request }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toBeVisible();
  await signInViaUi(page, request);
  await page.goto("/pricing");
  await expect(page.getByRole("banner").getByRole("link", { name: "Account" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toHaveCount(0);
});
