import { expect, test } from "@playwright/test";
import { firstJobId, popupState, signInViaUi, stubPopup } from "./helpers";

// Regression: "Apply at company" was a form POST answered with a 303 to the employer's site, which the
// CSP `form-action 'self'` blocks, so the button did nothing for a signed-in user.
test("Apply at company opens the employer page for a signed-in user, and counts the open", async ({ page, request, context }) => {
  const violations: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy|form-action/i.test(m.text())) violations.push(m.text()); });
  await context.route(/^https:\/\/(?!localhost).*/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>Employer</title>employer page" }));
  await stubPopup(page);
  await signInViaUi(page, request);
  const id = await firstJobId(page, request);
  await page.goto(`/job/${id}`);
  await page.getByRole("button", { name: /Apply at company/ }).click();
  await expect.poll(async () => (await popupState(page)).href, { timeout: 10_000 }).toMatch(/^https:\/\/.+\/jobs\//);
  expect(violations).toEqual([]);
});
