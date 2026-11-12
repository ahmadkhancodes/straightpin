import { expect, test } from "@playwright/test";

// Landing page rules (.claude/skills/landing-page-design/SKILL.md B11, A4, B10), measured in the browser.
const INK = "rgb(18, 20, 23)";
const wordColours = (page: import("@playwright/test").Page) =>
  page.$$eval("[data-testid=tagline] .kit-word", (ws) => ws.map((w) => getComputedStyle(w).color));

test("tagline words switch on one by one as the page scrolls, muted at 30% ink before", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const before = await wordColours(page);
  expect(before.length).toBeGreaterThan(10);
  for (const c of before) expect(c).toMatch(/\/ 0\.3\)$|, 0\.3\)$/);
  const top = await page.$eval("[data-testid=tagline]", (e) => e.getBoundingClientRect().top + scrollY);
  const counts: number[] = [];
  for (let y = top - 900; y <= top; y += 60) {
    await page.evaluate((v) => scrollTo(0, v), y);
    await page.waitForTimeout(120);
    counts.push((await wordColours(page)).length && (await page.$$eval("[data-testid=tagline] .kit-word[data-on=true]", (w) => w.length)));
  }
  // Partly lit at some point (not all at once), fully lit at the end, never going back.
  expect(counts.some((n) => n > 0 && n < before.length)).toBe(true);
  expect(counts.at(-1)).toBe(before.length);
  for (let i = 1; i < counts.length; i++) expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
  await page.waitForTimeout(600);
  for (const c of await wordColours(page)) expect(c).toBe(INK);
  // Screen readers read the sentence once.
  await expect(page.locator("[data-testid=tagline] .sr-only")).toHaveCount(1);
});

test("tagline is in full ink at once under reduced motion", async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const c of await wordColours(page)) expect(c).toBe(INK);
  await page.close();
});

for (const width of [390, 1440]) {
  test(`hero at ${width}: heading and subheading at most 680px, no sideways scroll, floating header`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const h1 = await page.locator("#hero-title").boundingBox();
    const sub = await page.locator("#hero-title + p").boundingBox();
    expect(h1!.width).toBeLessThanOrEqual(680);
    expect(sub!.width).toBeLessThanOrEqual(680);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    const bar = await page.locator("header > div").first().evaluate((e) => {
      const cs = getComputedStyle(e);
      return { top: e.getBoundingClientRect().top, blur: cs.backdropFilter, bg: cs.backgroundColor };
    });
    expect(bar.top).toBeGreaterThan(0);
    expect(bar.blur).toContain("blur");
    expect(bar.bg).not.toBe(INK);
  });
}
