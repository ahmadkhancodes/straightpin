import { test, expect } from "@playwright/test";
import { freePlan, product } from "../../../src/config/product";
import { firstJobId, ownIp, popupState, signInViaUi, stubPopup } from "../qa/helpers";

/**
 * Docs must work: every step in the in-app help (/docs/getting-started, /docs/account, /docs/billing) is done here
 * against the running app, in the order the page tells a person to do it. Billing steps that need a paid plan
 * (Cancel plan, Refund my first payment) are covered against the Stripe fake in tests/unit/billing-journey.test.ts
 * and their button labels in tests/unit/usefulness.test.ts.
 */
test("Getting started, step by step", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.goto("/docs/getting-started");
  for (const h of ["Sign in", "Pick your field", "Open a job and apply at the company", "How often jobs are checked"]) await expect(page.getByRole("heading", { name: h })).toBeVisible();

  // "Enter your email and we send you a link. Tap it and you are in: there is no password and nothing else to fill in."
  await stubPopup(page);
  await signInViaUi(page, request, `docs${Date.now()}@mail.test`);
  expect(page.url()).not.toContain("/onboarding");
  // "You can add a passkey later in Settings, under Security."
  await page.goto("/app/settings/security");
  await expect(page.getByRole("button", { name: /passkey/i }).first()).toBeVisible();

  // "Choose the kind of work you want ... then answer five short questions. We count the direct matches as you answer."
  await page.goto("/quiz");
  await page.getByRole("button", { name: "Customer support" }).click();
  for (const label of ["United States", "Anywhere, on site is fine", "Any pay", "Show every level", "Either"]) {
    await expect(page.getByTestId("live-count")).toContainText(/direct match/);
    await page.getByRole("button", { name: label }).click();
  }
  // "... then list them by how well they fit, newest first when two fit equally."
  await expect(page).toHaveURL(/\/matches\?/);
  await expect(page.getByText("Sorted by fit, newest first when tied.")).toBeVisible();

  // "Every job shows its first posted date, how many times it was reposted and the website it comes from."
  const id = await firstJobId(page, request);
  await page.goto(`/job/${id}`);
  for (const t of ["First posted by the company", "Reposts in the last 90 days", "Source", "Last checked"]) await expect(page.getByText(t, { exact: true })).toBeVisible();
  // "Back to matches keeps your answers."
  await page.getByRole("link", { name: "Back to matches" }).click();
  await expect(page.getByText(/Your matches · Customer support/i)).toBeVisible();
  // "Free accounts can open 5 jobs a day ... and save 10."
  await page.goto("/app");
  await expect(page.locator("main")).toContainText(`of ${freePlan.limits.opens} today`);
  await expect(page.locator("main")).toContainText(`of ${freePlan.limits.saves}`);
  // "Tap Apply at company and the employer's own page opens."
  await page.goto(`/job/${id}`);
  await page.getByRole("button", { name: /Apply at company/ }).click();
  await expect.poll(async () => (await popupState(page)).href).toMatch(/^https?:\/\/(?!localhost)/);
});

test("Your account: download your data and delete the account from Settings and Account", async ({ page, request }) => {
  await ownIp(page);
  await signInViaUi(page, request, `docsacct${Date.now()}@mail.test`);
  await page.goto("/docs/account");
  await expect(page.getByText(`Email ${product.supportEmail}. A person reads it.`)).toBeVisible();
  for (const path of ["/app/settings/profile", "/account"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: /Download my data/ }).or(page.getByRole("button", { name: /Download my data/ })).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete my account" })).toBeVisible();
  }
  const res = await page.request.get("/api/account/export");
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(JSON.stringify(data)).toContain("docsacct");
});

test("Billing and refunds: the plans and numbers are the ones on sale", async ({ page }) => {
  await page.goto("/docs/billing");
  for (const plan of product.plans) await expect(page.getByText(new RegExp(`^${plan.name} \\(`))).toBeVisible();
  await expect(page.getByText(new RegExp(`within ${product.refundDays} days of your first payment`))).toBeVisible();
  await expect(page.getByText(new RegExp(`stays active for ${product.graceDays} days`))).toBeVisible();
  // "Open Account": the Account page is where a signed out person is sent to sign in first.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in/);
});
