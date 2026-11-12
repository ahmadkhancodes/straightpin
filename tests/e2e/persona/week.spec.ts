import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { ownIp, popupState, stubPopup } from "../qa/helpers";

/**
 * A week in the life of three people from the ICP (docs/QA-REPORT.md, usefulness pass):
 * Rhonda (phone, remote support, US), Pat (UK, admin, Manchester) and Leo (desktop, project coordinator, US).
 */

/** Sign in from wherever the page sent us (the sign-in form is already open), with the link from the outbox. */
async function finishSignIn(page: Page, request: APIRequestContext, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/Check your inbox/)).toBeVisible();
  const box = await (await request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`)).json();
  await page.goto(/https?:\/\/\S+magic-link\/verify\S+/.exec(box.messages.at(-1).text)![0]);
  await page.waitForURL((u) => !u.pathname.startsWith("/onboarding") && !u.pathname.startsWith("/api/auth"));
  await page.waitForLoadState("networkidle");
}

test.describe("Rhonda, on her phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("day 1: from the home page to Apply at company within the click budget, then sign up without retyping anything", async ({ page, request }) => {
    test.setTimeout(120_000);
    await request.post("/api/dev/seed-jobs");
    await ownIp(page);
    await stubPopup(page);
    let clicks = 0;
    const click = async (l: ReturnType<Page["locator"]>) => { clicks++; await l.click(); await page.waitForLoadState(); };

    await page.goto("/");
    await click(page.locator("main a[href*='/quiz']:visible").first());
    if (page.url().endsWith("/quiz")) await click(page.getByRole("button", { name: "Customer support" }));
    await click(page.getByRole("button", { name: "United States" }));
    await click(page.getByRole("button", { name: "Remote only" }));
    await click(page.getByRole("button", { name: "Any pay" }));
    await click(page.getByRole("button", { name: "Just starting out" }));
    await click(page.getByRole("button", { name: "Full time" }));
    await expect(page).toHaveURL(/\/matches\?field=support/);
    await click(page.locator("a[href^='/job/']").first());
    await page.waitForURL(/\/job\//);
    const jobUrl = page.url();
    await click(page.getByRole("button", { name: /Apply at company/ }));
    // Budget: 1 to start, 6 answers, 1 job, 1 Apply = 9 at most (brief: first value in under 10 minutes on a phone).
    expect(clicks).toBeLessThanOrEqual(9);

    // Signed out, Apply asks for an account. No organization form after the link, straight back to the job.
    await expect(page).toHaveURL(/\/sign-in/);
    await finishSignIn(page, request, `rhonda${Date.now()}@mail.test`);
    await expect(page).toHaveURL(jobUrl);
    await expect(page.getByText(/Name your organization|Organization name/)).toHaveCount(0);
    await page.getByRole("button", { name: /Apply at company/ }).click();
    await expect.poll(async () => (await popupState(page)).href).toMatch(/^https?:\/\//);

    // Back to matches keeps her answers; Alerts and the checklist already know her field.
    await page.goto(jobUrl);
    await page.getByRole("link", { name: "Back to matches" }).click();
    await expect(page).toHaveURL(/\/matches/);
    await expect(page.getByText(/Your matches · Customer support · the US/i)).toBeVisible();
    await expect(page.locator("select[name=remote]")).toHaveValue("remote");
    await page.goto("/alerts");
    await expect(page.getByRole("heading", { name: "Email alerts" })).toBeVisible();
    // She signed up from a job, not from "get a daily email", so the email waits for her to switch it on.
    await expect(page.locator("select[name=digest]")).toHaveValue("off");
    await page.goto("/app");
    await expect(page.locator("main")).toContainText("My job search");
    await expect(page.getByText(/1 of 4 done|2 of 4 done|3 of 4 done/)).toBeVisible();
  });

  test("signed out, Back to matches from a job keeps the answers instead of restarting the quiz", async ({ page, request }) => {
    await request.post("/api/dev/seed-jobs");
    await page.goto("/matches?field=support&country=US&remote=any&payFloor=15&level=any&schedule=any");
    await page.locator("a[href^='/job/']").first().click();
    await page.getByRole("link", { name: "Back to matches" }).click();
    await expect(page).toHaveURL(/\/matches\?field=support&country=US&remote=any&payFloor=15/);
  });

  test("day 7: out of free opens, the paywall says when they come back and checkout fails calmly", async ({ page, request }) => {
    test.setTimeout(120_000);
    await request.post("/api/dev/seed-jobs");
    await ownIp(page);
    await stubPopup(page);
    await page.goto("/sign-in?next=/saved");
    await finishSignIn(page, request, `rhonda7${Date.now()}@mail.test`);
    await page.goto("/matches?field=support&country=US&remote=any&payFloor=0&level=any&schedule=any");
    const hrefs = [...new Set(await page.locator("a[href^='/job/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!)))];
    expect(hrefs.length).toBeGreaterThan(5);
    for (const h of hrefs.slice(0, 6)) {
      await page.goto(h);
      await page.getByRole("button", { name: /Apply at company/ }).click();
      await page.waitForTimeout(400);
    }
    await expect(page).toHaveURL(/\/paywall\?reason=opens/);
    await expect(page.getByText(/You get them back in (\d+ hours?|under an hour) \(midnight UTC\)/)).toBeVisible();
    await expect(page.getByText(/Monthly/).first()).toBeVisible();
    await page.getByRole("button", { name: /Continue with Monthly/ }).click();
    await expect(page.getByText(/Nothing was charged/)).toBeVisible();
    // Coming back from a closed Checkout, and from a paid one before the webhook lands.
    await page.goto("/account?checkout=canceled");
    await expect(page.getByText("Checkout closed")).toBeVisible();
    await page.goto("/account?checkout=success&session_id=cs_test_x");
    await expect(page.getByText("Turning your plan on")).toBeVisible();
    await expect(page.getByText("Thanks, your plan is on")).toHaveCount(0);
  });
});

test.describe("Pat, in Manchester", () => {
  test("pay is in pounds in the quiz, the filters and the match reasons", async ({ page, request }) => {
    await request.post("/api/dev/seed-jobs");
    await page.goto("/quiz?field=admin&country=UK&remote=any");
    await expect(page.getByRole("button", { name: "£15 an hour or more" })).toBeVisible();
    await expect(page.getByRole("button", { name: /\$15/ })).toHaveCount(0);
    await page.goto("/matches?field=admin&country=UK&remote=any&payFloor=0&level=any&schedule=any");
    const main = await page.locator("main").innerText();
    expect(main).toMatch(/£/);
    expect(main).not.toMatch(/up to \$\d/);
    await expect(page.locator("select[name=payFloor] option", { hasText: "£20 an hour or more" })).toHaveCount(1);
  });
});

test.describe("Leo, on a laptop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("day 2: Create a free account from his matches turns the daily email on with his answers", async ({ page, request }) => {
    test.setTimeout(90_000);
    await request.post("/api/dev/seed-jobs");
    await ownIp(page);
    await page.goto("/matches?field=project&country=US&remote=remote_hybrid&payFloor=0&level=mid&schedule=full");
    await page.getByRole("link", { name: "Create a free account" }).click();
    await finishSignIn(page, request, `leo${Date.now()}@mail.test`);
    await expect(page).toHaveURL(/\/matches\?field=project&country=US&remote=remote_hybrid/);
    await expect(page.getByRole("button", { name: "Save and email me" })).toHaveCount(0);
    await page.goto("/alerts");
    await expect(page.locator("select[name=digest]")).toHaveValue("on");
  });
});
