import { expect, test } from "@playwright/test";
import { product } from "../../../src/config/product";
import { firstJobId, signInViaUi } from "../qa/helpers";

const allPrices = product.plans.flatMap((p) => p.prices.map((x) => x.usd / 100));
const fmt = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

test("pricing and landing print only prices that exist in product.ts (or a dated competitor price from the brief)", async ({ page }) => {
  for (const path of ["/", "/pricing"]) {
    await page.goto(path);
    const text = await page.locator("main").innerText();
    const shown = [...text.matchAll(/\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g)].map((m) => Number(m[1]!.replace(",", "")));
    // pay in the labelled sample listings ("$19 to $24 an hour") is not a price of ours
    const pay = new Set([...text.matchAll(/C?\$(\d+(?:\.\d+)?)(?: to C?\$(\d+(?:\.\d+)?))? (?:an|per) hour/g)].flatMap((m) => [Number(m[1]), Number(m[2])]));
    const stray = shown.filter((n) => !allPrices.includes(n) && !pay.has(n) && ![21, 10.5, 47].includes(n) && n !== 0);
    expect(stray, `${path} shows a price that is not in product.ts or the brief`).toEqual([]);
  }
  await page.goto("/pricing");
  const text = await page.locator("main").innerText();
  for (const p of product.plans.filter((x) => x.onSale && x.prices.length)) {
    expect(text, `/pricing lists ${p.name}`).toContain(p.name);
    expect(text, `/pricing shows ${p.name} price`).toContain(fmt(p.prices[0]!.usd / 100));
  }
});

test("no invented proof: no star ratings, user counts, logo walls or testimonials on public pages", async ({ page }) => {
  for (const path of ["/", "/pricing", "/compare/directroles", "/how-we-check"]) {
    await page.goto(path);
    const text = (await page.locator("main").innerText()).toLowerCase();
    expect(text, path).not.toMatch(/★|rated \d|trusted by|\d[\d,]* (happy )?(users|customers|members|job seekers)|as seen (on|in)|testimonial/);
  }
});

for (const w of [320, 768, 1024]) {
  test(`no horizontal scroll at ${w}px on the main screens`, async ({ page, request }) => {
    await page.setViewportSize({ width: w, height: 800 });
    await request.post("/api/dev/seed-jobs");
    const bad: string[] = [];
    for (const p of ["/", "/pricing", "/compare/directroles", "/how-we-check", "/jobs", "/quiz", "/sign-in", "/docs", "/legal/terms", "/matches?field=support&country=US&remote=any&payFloor=0&level=any&schedule=any"]) {
      await page.goto(p);
      await page.waitForLoadState("load");
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) bad.push(p);
    }
    expect(bad).toEqual([]);
  });
}

test("sign out lands on a public page and /app asks to sign in again; billing return pages stay calm", async ({ page, request }) => {
  await signInViaUi(page, request);
  await page.goto("/app");
  await page.getByRole("button", { name: /sign out/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/app"));
  await page.goto("/app");
  await expect(page).toHaveURL(/sign-in/);
});

test("billing return pages and paywall never 500", async ({ page, request }) => {
  await signInViaUi(page, request);
  for (const p of ["/app/billing?checkout=success", "/app/billing?checkout=cancelled", "/paywall", "/paywall?reason=opens"]) {
    const r = await page.goto(p);
    expect(r?.status(), p).toBeLessThan(500);
  }
});

test("Save and alert buttons do something observable and break no CSP rule", async ({ page, request }) => {
  const violations: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
  await signInViaUi(page, request);
  const id = await firstJobId(page, request);
  await page.goto(`/job/${id}`);
  await page.getByRole("button", { name: /^save/i }).first().click();
  await expect(page.getByRole("button", { name: /saved|unsave|remove/i }).first()).toBeVisible();
  await page.goto("/saved");
  await expect(page.locator(`a[href="/job/${id}"]`).first()).toBeVisible();
  expect(violations).toEqual([]);
});
