import { expect, test } from "@playwright/test";

test("favicon.ico resolves to a 200", async ({ request }) => {
  const res = await request.get("/favicon.ico");
  expect(res.status()).toBe(200);
});

test("public pages emit og:image and twitter:image pointing at the opengraph-image route", async ({ request }) => {
  for (const path of ["/", "/pricing", "/bot", "/about/data", "/how-we-check"]) {
    const html = await (await request.get(path)).text();
    expect(html, path).toMatch(/<meta[^>]+property="og:image"[^>]+content="https?:\/\/[^"]+\/opengraph-image/);
    expect(html, path).toMatch(/<meta[^>]+name="twitter:image"[^>]+content="https?:\/\/[^"]+\/opengraph-image/);
  }
});

test("inline links on /bot and /about/data are at least 24px tall on phones", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/bot", "/about/data"]) {
    await page.goto(path);
    const links = page.locator("main p a, main li a");
    const n = await links.count();
    expect(n, path).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const box = await links.nth(i).boundingBox();
      if (box) expect(box.height, `${path} link ${i}`).toBeGreaterThanOrEqual(24);
    }
  }
});
