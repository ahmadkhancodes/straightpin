/**
 * Playwright screenshots of every route at 375 and 1440, light and dark -> docs/qa/<date>/.
 *   BASE_URL=http://localhost:3000 npx tsx scripts/screenshots.ts [/extra /routes]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ROUTES = ["/", "/pricing", "/docs", "/docs/getting-started", "/legal/privacy", "/legal/terms", "/compare/web3forms", "/sign-in", "/this-page-does-not-exist", ...process.argv.slice(2)];
const OUT = process.env.OUT_DIR ?? `docs/qa/${new Date().toISOString().slice(0, 10)}`;
const WIDTHS = [375, 1440];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problems: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 800 ? 812 : 900 }, deviceScaleFactor: 1, colorScheme: theme });
      await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
      const page = await ctx.newPage();
      for (const r of ROUTES) {
        await page.goto(BASE + r, { waitUntil: "networkidle" });
        await page.evaluate(async () => {
          // trigger scroll reveals, then return to top
          for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((s) => setTimeout(s, 40)); }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(400);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 0) problems.push(`${r} @${width} ${theme}: horizontal overflow ${overflow}px`);
        const name = `${r === "/" ? "home" : r.slice(1).replace(/\//g, "_")}-${width}-${theme}.png`;
        await page.screenshot({ path: `${OUT}/${name}`, fullPage: true });
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`screenshots in ${OUT}`);
  if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
}
main();
