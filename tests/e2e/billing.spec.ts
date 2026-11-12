import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "docs/qa/m3";
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function shots(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  for (const [width, height] of [[375, 812], [1440, 900]] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    expect(await noOverflow(page), `${name} ${width}`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${OUT}/${name}-${width}-light.png`, fullPage: true });
  }
}

test("paywall: Monthly pre-selected, price and refund visible, close works, prices from product.ts", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/paywall?reason=opens&from=%2Fmatches");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("used today");
  const monthly = page.getByRole("radio", { name: /^Monthly/ });
  await expect(monthly).toBeChecked();
  await expect(page.getByText("$10.99").first()).toBeVisible();
  await expect(page.getByText("Full refund in the first 7 days")).toBeVisible();
  await expect(page.getByText("Renews every month at $10.99 until you cancel.")).toBeVisible();
  for (const name of [/^Weekly/, /^Lifetime/]) await expect(page.getByRole("radio", { name })).toBeVisible();
  // Plus is not on sale until its features exist (REVIEW P0-1)
  await expect(page.getByRole("radio", { name: /^Plus/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /^Lifetime/ }).check();
  await expect(page.getByText("One payment, no renewal.")).toBeVisible();
  await page.getByRole("radio", { name: /^Monthly/ }).check();
  // signed out: the primary action is to sign in, never a dead end
  await expect(page.getByRole("link", { name: "Sign in to continue" })).toBeVisible();
  const close = page.getByRole("link", { name: "Close and go back" });
  const box = await close.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await shots(page, "paywall");
  await close.click();
  await expect(page).toHaveURL(/\/matches/);
  // an outside address in ?from= is ignored
  await page.goto("/paywall?from=https%3A%2F%2Fevil.test");
  await expect(page.getByRole("link", { name: "Close and go back" })).toHaveAttribute("href", "/matches");
});

test("account: sign in required, free plan shows See plans, signed in paywall keeps working", async ({ page, request, baseURL }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in/);

  const email = `m3+${Date.now()}@studio.test`;
  const origin = { origin: baseURL! };
  expect((await page.request.post("/api/auth/sign-in/magic-link", { data: { email, callbackURL: "/account" }, headers: origin })).ok()).toBeTruthy();
  let text = "";
  await expect.poll(async () => {
    const box = await (await request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`)).json();
    text = box.messages.at(-1)?.text ?? "";
    return text;
  }).toContain("magic-link/verify");
  await page.goto(/https?:\/\/\S+magic-link\/verify\S+/.exec(text)![0]);
  const org = await page.request.post("/api/auth/organization/create", { data: { name: "Harbor Studio", slug: `m3-${Date.now()}` }, headers: origin });
  await page.request.post("/api/auth/organization/set-active", { data: { organizationId: (await org.json()).id }, headers: origin });

  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Account");
  await expect(page.getByTestId("plan-name")).toHaveText("Free");
  await expect(page.getByRole("button", { name: /Cancel plan|Refund/ })).toHaveCount(0);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await shots(page, "account");

  await page.getByRole("link", { name: "See plans" }).click();
  await expect(page).toHaveURL(/\/paywall/);
  await expect(page.getByRole("radio", { name: /^Monthly/ })).toBeChecked();
  // billing is not connected in the test server: a clear message, nothing charged
  await page.getByRole("button", { name: /Continue with Monthly, \$10.99/ }).click();
  await expect(page.getByText("Payments are not switched on yet. Nothing was charged.")).toBeVisible();
  // admin pages are not discoverable for a normal user
  expect((await page.goto("/admin/review"))!.status()).toBe(404);
  expect((await page.request.post("/api/admin/review", { headers: origin, form: { jobId: "x", label: "agency" } })).status()).toBe(404);
});

test("/bot and /about/data are public and name the user agent and the way to stop us", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/bot");
  await expect(page.getByText("StraightpinByBufferSolBot (+https://straightpin.buffersoltech.com/bot)")).toBeVisible();
  await expect(page.getByText("Disallow: /")).toBeVisible();
  await expect(page.getByRole("link", { name: "contact@buffersoltech.com" }).first()).toBeVisible();
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await page.goto("/about/data");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("What we store");
  await expect(page.getByText("never the whole posting")).toBeVisible();
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
});
