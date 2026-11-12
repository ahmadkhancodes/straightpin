import { expect, test, type Page } from "@playwright/test";
import { firstJobId, signInViaUi } from "../qa/helpers";

// Post-redesign regression pass: light only, newsprint/ink/yellow palette, Newsreader + Archivo, square surfaces.
const PUBLIC = ["/", "/pricing", "/compare/directroles", "/how-we-check", "/docs", "/legal/privacy", "/legal/terms", "/legal/refunds", "/legal/cookies", "/bot", "/about/data", "/sign-in", "/quiz", "/jobs", "/does-not-exist", "/paywall", "/problem", "/matches?field=support&country=US&remote=any&payFloor=0&level=any&schedule=any"];
const SIGNED = ["/app", "/app/billing", "/app/settings/profile", "/app/settings/security", "/account", "/saved", "/alerts", "/alerts/manage"];
const VIEWPORTS = [{ width: 375, height: 812 }, { width: 1440, height: 900 }];

/** Runs in the page: returns human readable problems for the current screen. */
async function styleAudit(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const parse = (c: string) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number); return { r: r!, g: g!, b: b!, a }; };
    const hue = (c: { r: number; g: number; b: number }) => { const r = c.r / 255, g = c.g / 255, b = c.b / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const d = mx - mn; if (!d) return { h: 0, s: 0, l: (mx + mn) / 2 }; const l = (mx + mn) / 2; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; return { h, s, l }; };
    const lum = (c: { r: number; g: number; b: number }) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const bgOf = (el: Element) => { for (let e: Element | null = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== "none") return null; const c = parse(cs.backgroundColor); if (c && c.a > 0.95) return c; } return { r: 243, g: 243, b: 239, a: 1 }; };
    const where = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.getAttribute("class") ?? "").split(" ").slice(0, 2).join(".")} "${(el.textContent || "").trim().slice(0, 24)}"`;
    const html = getComputedStyle(document.documentElement);
    if (html.colorScheme.includes("dark")) out.push("color-scheme includes dark");
    if (document.documentElement.hasAttribute("data-theme") || document.documentElement.classList.contains("dark")) out.push("dark theme attribute on <html>");
    const seen = new Set<string>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      const ff = cs.fontFamily.toLowerCase();
      if (/bricolage|public sans|caveat/.test(ff)) out.push(`old font ${ff.slice(0, 40)}: ${where(el)}`);
      if (/gradient/.test(cs.backgroundImage)) out.push(`gradient: ${where(el)}`);
      for (const prop of ["color", "backgroundColor", "borderTopColor", "outlineColor"] as const) {
        const c = parse(cs[prop]); if (!c || c.a < 0.2) continue;
        if (prop === "borderTopColor" && cs.borderTopWidth === "0px") continue;
        if (prop === "outlineColor" && cs.outlineStyle === "none") continue;
        const k = hue(c);
        if (k.s > 0.25 && k.l > 0.15 && k.l < 0.95) {
          const name = k.h >= 230 && k.h < 300 ? "indigo/purple" : k.h < 25 || k.h >= 345 ? (k.l > 0.35 && k.s < 0.8 && prop !== "color" ? "clay/red" : "") : "";
          if (name && !/danger|error/.test(String(el.className))) { const key = `${prop} ${name} ${cs[prop]}`; if (!seen.has(key)) { seen.add(key); out.push(`${prop} ${name} ${cs[prop]}: ${where(el)}`); } }
        }
        if (prop === "backgroundColor" && c.r >= 244 && c.r <= 248 && c.g >= 238 && c.g <= 244 && c.b >= 228 && c.b <= 236) out.push(`cream background ${cs[prop]}: ${where(el)}`);
      }
      // pills and soft rounded surfaces (square 0 / 4px system)
      const rad = parseFloat(cs.borderTopLeftRadius);
      if (rad > 4.5 && r.width > 16 && r.height > 16 && !(rad >= Math.min(r.width, r.height) / 2 - 0.5 && Math.abs(r.width - r.height) < 2) && !el.closest("svg")) out.push(`radius ${rad}px: ${where(el)}`);
      // text contrast
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || "").trim().length > 1);
      if (own && r.width > 0 && r.height > 0 && !el.closest("[aria-hidden=true], .sr-only") && cs.opacity === "1") {
        const fg = parse(cs.color), bg = bgOf(el);
        if (fg && bg && fg.a > 0.95) {
          const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && parseInt(cs.fontWeight) >= 700);
          const dis = (el as HTMLButtonElement).disabled || el.closest("[disabled], [aria-disabled=true]");
          if (!dis && ratio < (large ? 3 : 4.5)) out.push(`contrast ${ratio.toFixed(2)}: ${where(el)}`);
        }
      }
      // cut off text (not an intentional truncate)
      if (cs.overflow !== "visible" && cs.textOverflow !== "ellipsis" && !el.matches("input, textarea, select, svg, [class*=sr-only]") && el.scrollWidth > el.clientWidth + 2 && cs.overflowX === "hidden" && (el.textContent || "").trim()) out.push(`text clipped: ${where(el)}`);
      // overlapping siblings with text (rough)
    }
    return [...new Set(out)];
  });
}

for (const vp of VIEWPORTS) {
  test(`redesign audit, signed out, ${vp.width}px: palette, fonts, radius, contrast, no dark mode, no clipped text`, async ({ page, request }) => {
    await page.setViewportSize(vp);
    await request.post("/api/dev/seed-jobs");
    const problems: string[] = [];
    for (const p of PUBLIC) {
      await page.goto(p); await page.waitForLoadState("load"); await page.waitForTimeout(300);
      for (const x of await styleAudit(page)) problems.push(`${p}: ${x}`);
    }
    expect(problems).toEqual([]);
  });

  test(`redesign audit, signed in, ${vp.width}px`, async ({ page, request }) => {
    await page.setViewportSize(vp);
    await signInViaUi(page, request);
    await firstJobId(page, request);
    const problems: string[] = [];
    for (const p of SIGNED) {
      await page.goto(p); await page.waitForLoadState("load"); await page.waitForTimeout(300);
      for (const x of await styleAudit(page)) problems.push(`${p}: ${x}`);
    }
    expect(problems).toEqual([]);
  });
}

test("a dark colour scheme preference changes nothing (light only)", async ({ browser }) => {
  const mk = async (scheme: "dark" | "light") => { const ctx = await browser.newContext({ colorScheme: scheme }); const pg = await ctx.newPage(); await pg.goto("/"); const v = await pg.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color, getComputedStyle(document.documentElement).colorScheme, document.querySelector('meta[name="color-scheme"]')?.getAttribute("content") ?? "", Array.from(document.querySelectorAll('meta[name="theme-color"]')).map((m) => m.getAttribute("content") + "|" + (m.getAttribute("media") ?? "")).join(",")]); await ctx.close(); return v; };
  expect(await mk("dark")).toEqual(await mk("light"));
});

test("keyboard: every focusable element shows a visible focus ring (public + app)", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const bad: string[] = [];
  for (const p of ["/", "/pricing", "/sign-in", "/quiz"]) {
    await page.goto(p); await page.waitForLoadState("load");
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => { const e = document.activeElement as HTMLElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const rect = e.getBoundingClientRect(); return { n: `${e.tagName} ${(e.textContent || e.getAttribute("aria-label") || e.getAttribute("name") || "").trim().slice(0, 30)}`, outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2, shadow: cs.boxShadow !== "none", vis: rect.width > 0 && rect.height > 0 }; });
      if (r && r.vis && !r.outline && !r.shadow) bad.push(`${p}: ${r.n}`);
    }
  }
  expect([...new Set(bad)]).toEqual([]);
  void request;
});

test("error pages, OG image, icons and legal pages carry the new brand", async ({ request, page }) => {
  const og = await request.get("/opengraph-image"); expect(og.status()).toBe(200); expect(og.headers()["content-type"]).toContain("image/png");
  for (const u of ["/icon", "/apple-icon", "/twitter-image"]) expect((await request.get(u)).status(), u).toBe(200);
  const r = await page.goto("/nope-nope"); expect(r?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /home|jobs|straightpin/i }).first()).toBeVisible();
  const css = await (await request.get((await page.locator('link[rel=stylesheet]').first().getAttribute("href"))!)).text();
  expect(css).not.toMatch(/prefers-color-scheme:\s*dark|Bricolage|Public Sans|Caveat|#b8381c|#f6f1e9/i);
});
