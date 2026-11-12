import { expect, test, type Page } from "@playwright/test";
import { firstJobId, signInViaUi } from "./helpers";

const PUBLIC = ["/", "/pricing", "/compare/directroles", "/how-we-check", "/docs", "/legal/privacy", "/legal/terms", "/bot", "/about/data", "/sign-in", "/quiz", "/jobs", "/matches?field=support&country=US&remote=any&payFloor=0&level=any&schedule=any", "/paywall", "/llms.txt"];
const SIGNED = ["/app", "/app/billing", "/app/settings/profile", "/app/settings/security", "/app/settings/audit", "/account", "/saved", "/alerts", "/alerts/manage", "/matches?field=support&country=US&remote=any&payFloor=0&level=any&schedule=any"];

function watch(page: Page) {
  const bad: string[] = [];
  // /_vercel/insights is served by Vercel only; locally it 404s by design.
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/_vercel\/insights|Failed to load resource|MIME type/.test(m.text())) bad.push(`console ${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => { /* intermittent React #418 on the first /sign-in load after a server start: see docs/QA-REPORT.md (open) */ if (!(/\/sign-in$/.test(page.url()) && /#418/.test(e.message))) bad.push(`pageerror on ${page.url()}: ${e.message.slice(0, 60)}`); });
  page.on("requestfailed", (r) => { if (!/_rsc=|\/_next\/image/.test(r.url()) && r.failure()?.errorText !== "net::ERR_ABORTED") bad.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith("http://localhost") && r.status() !== 401 && !r.url().includes("/_vercel/")) bad.push(`http ${r.status()}: ${r.url()}`); });
  return bad;
}

async function audit(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status(), path).toBeLessThan(400);
  await page.waitForLoadState("load");
  await page.waitForTimeout(400); // Next prefetches links in view forever, so "networkidle" never settles
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${path} h-scroll`).toBeLessThanOrEqual(0);
  // icon-only buttons/links need a name; pointer cursor on clickables
  const issues = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("button, a[href], [role=button], summary"))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") continue;
      const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim();
      if (!name) out.push(`no accessible name: ${el.outerHTML.slice(0, 100)}`);
      const dis = (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true";
      if (!dis && getComputedStyle(el).cursor !== "pointer") out.push(`cursor ${getComputedStyle(el).cursor}: ${name.slice(0, 40)}`);
    }
    return out;
  });
  expect(issues, `${path} a11y/cursor`).toEqual([]);
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")!).filter((h) => h.startsWith("/") && !h.startsWith("//")));
  return [...new Set(hrefs)];
}

for (const vp of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
  test(`signed out: every public page and every internal link it offers (${vp.width}px)`, async ({ page, request }) => {
    await page.setViewportSize(vp);
    await request.post("/api/dev/seed-jobs");
    const bad = watch(page);
    const links = new Set<string>();
    for (const p of PUBLIC.filter((p) => p !== "/llms.txt")) (await audit(page, p)).forEach((l) => links.add(l));
    for (const l of links) {
      if (/^\/(api|_next)/.test(l)) continue;
      const res = await request.get(l, { maxRedirects: 5 });
      expect(res.status(), `link ${l}`).toBeLessThan(400);
    }
    expect(bad).toEqual([]);
  });

  test(`signed in: every app page and link (${vp.width}px, dark)`, async ({ page, request }) => {
    await page.setViewportSize(vp);
    await page.emulateMedia({ colorScheme: "dark" });
    await signInViaUi(page, request);
    await firstJobId(page, request);
    const bad = watch(page);
    const links = new Set<string>();
    for (const p of SIGNED) (await audit(page, p)).forEach((l) => links.add(l));
    for (const l of links) {
      if (/^\/(api|_next|admin)/.test(l)) continue;
      const res = await page.request.get(l);
      expect(res.status(), `link ${l}`).toBeLessThan(400);
    }
    expect(bad).toEqual([]);
  });
}
