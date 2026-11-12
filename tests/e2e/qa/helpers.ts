import { expect, type Page, type APIRequestContext } from "@playwright/test";

export const ORIGIN = "http://localhost:3100";

/** Sign in the way a user does: sign-in form, then the link from the outbox. Returns the e-mail used. */
export async function signInViaUi(page: Page, request: APIRequestContext, email = `qa+${Date.now()}${Math.floor(Math.random() * 1e4)}@studio.test`) {
  // Better Auth rate-limits per IP (a handful of links a minute); give every simulated person their own address.
  await ownIp(page);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/Check your inbox/)).toBeVisible();
  const box = await (await request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`)).json();
  const link = /https?:\/\/\S+magic-link\/verify\S+/.exec(box.messages.at(-1).text)?.[0];
  expect(link).toBeTruthy();
  await page.goto(link!);
  await finishOnboarding(page);
  return email;
}

export async function firstJobId(page: Page, request: APIRequestContext) {
  await request.post("/api/dev/seed-jobs");
  await page.goto("/matches?field=support&country=US&remote=any&payFloor=0&level=any&schedule=any");
  const href = await page.getByRole("link", { name: "Customer Support Specialist" }).first().getAttribute("href");
  return href!.split("/job/")[1]!;
}

/** New accounts land on /onboarding and must name an organization before anything else works. */
export async function finishOnboarding(page: Page, name = "QA Studio") {
  await page.waitForLoadState("networkidle");
  if (!page.url().includes("/onboarding")) return;
  await page.getByLabel("Organization name").fill(name);
  await page.getByRole("button", { name: "Create organization" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/onboarding"));
}

export const ownIp = (page: Page) => page.context().setExtraHTTPHeaders({ "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` });
