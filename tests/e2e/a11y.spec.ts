import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";

// axe-core is already installed (it comes with eslint-plugin-jsx-a11y), so no new dependency. It is injected into
// the page and run directly. Serious and critical findings fail the test. Phone width first (REVIEW P1-9).
const axePath = createRequire(process.cwd() + "/package.json").resolve("axe-core/axe.min.js");

type Violation = { id: string; impact: string | null; help: string; nodes: { target: unknown[] }[] };
async function serious(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Violation[] }> } }).axe;
    // The tagline reveal words are an aria-hidden visual copy of an sr-only sentence; unread words sit at 30% ink on
    // purpose (library B11), so they are left out of the contrast check. Everything else on the page is checked.
    return (await axe.run({ include: [document], exclude: [["[data-testid=tagline] [aria-hidden]"]] }, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations;
  });
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

test("axe: no serious or critical findings on the main pages at 375 px", async ({ page, request, baseURL }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 812 });
  expect((await request.post("/api/dev/seed-jobs")).ok()).toBeTruthy();

  const matches = "/matches?field=support&country=US&remote=any&payFloor=0&level=any&schedule=any";
  await page.goto(matches);
  const jobHref = await page.locator('a[href^="/job/"]').first().getAttribute("href");
  expect(jobHref).toBeTruthy();

  const email = `a11y+${Date.now()}@studio.test`;
  const origin = { origin: baseURL! };
  expect((await page.request.post("/api/auth/sign-in/magic-link", { data: { email, callbackURL: "/account" }, headers: origin })).ok()).toBeTruthy();
  let text = "";
  await expect.poll(async () => {
    const box = await (await request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`)).json();
    text = box.messages.at(-1)?.text ?? "";
    return text;
  }).toContain("magic-link/verify");
  await page.goto(/https?:\/\/\S+magic-link\/verify\S+/.exec(text)![0]);
  const org = await page.request.post("/api/auth/organization/create", { data: { name: "Harbor Studio", slug: `a11y-${Date.now()}` }, headers: origin });
  await page.request.post("/api/auth/organization/set-active", { data: { organizationId: (await org.json()).id }, headers: origin });

  const found: Record<string, string[]> = {};
  for (const path of ["/", "/paywall", "/quiz", matches, jobHref!, "/account", "/pricing"]) {
    await page.goto(path);
    await page.waitForTimeout(250);
    const v = await serious(page);
    if (v.length) found[path] = v;
  }
  expect(found).toEqual({});
});
