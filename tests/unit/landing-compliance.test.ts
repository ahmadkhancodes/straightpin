import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaglineReveal } from "@/components/marketing/tagline-reveal";

// Landing page rules from .claude/skills/landing-page-design/SKILL.md and docs/factory/DESIGN_PLAYBOOK.md.
const css = readFileSync("src/app/globals.css", "utf8");
const home = readFileSync("src/app/(marketing)/page.tsx", "utf8");
const marketing = [
  "src/app/(marketing)/page.tsx",
  "src/app/(marketing)/pricing/page.tsx",
  ...["faq", "final-cta", "how-it-works", "pricing-table", "notice-card", "site-header", "site-footer", "field-picker", "compare-table", "tagline-reveal"].map(
    (n) => `src/components/marketing/${n}.tsx`,
  ),
  "src/content/sample-jobs.ts",
];

/** Visible copy: JSX text and the values of copy keys (q, a, title, body, term, note, label, cta). */
function copyOf(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/>\s*([^<>{}]*[A-Za-z][^<>{}]*)\s*</g)) out.push(m[1]!);
  for (const m of src.matchAll(/\b(?:q|a|title|body|term|note|label|text)\s*[:=]\s*(?:"([^"]*)"|`([^`]*)`)/g)) out.push((m[1] ?? m[2])!);
  return out.map((s) => s.replace(/\$\{[^}]*\}/g, " "));
}

describe("landing page compliance", () => {
  it("has no hyphenated words in visible marketing copy (B1)", () => {
    const bad: string[] = [];
    for (const f of marketing) {
      for (const s of copyOf(readFileSync(f, "utf8"))) {
        // Host names, paths and file names keep their hyphens.
        const words = s.split(/\s+/).filter((w) => !/[./@]/.test(w));
        for (const w of words) if (/[A-Za-z]-[A-Za-z]/.test(w)) bad.push(`${f}: ${w}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every named text style lands on a Tailwind size step and weight <= 700, no italics", () => {
    const steps = [12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96, 128];
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)(rem|px)/g)].map((m) => (m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1])));
    expect(sizes.length).toBeGreaterThan(20);
    for (const s of sizes) expect(steps).toContain(s);
    for (const m of css.matchAll(/font-weight:\s*(\d+)/g)) expect(Number(m[1])).toBeLessThanOrEqual(700);
    expect(css).not.toMatch(/font-style:\s*italic/);
    for (const name of ["heading-1", "body-4", "button-md", "caption-2"]) expect(css).toContain(`@utility ${name} {`);
  });

  it("uses the base curve and no motion under 300ms on the landing page", () => {
    expect(css).toMatch(/--default-transition-timing-function:\s*cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
    for (const f of marketing) expect(readFileSync(f, "utf8"), f).not.toMatch(/duration-(75|100|150|200)\b/);
    expect(css).not.toMatch(/\b[12]\d\dms\b/);
  });

  it("keeps the hero heading and subheading at most 680px wide", () => {
    const hero = home.slice(home.indexOf('id="hero-title"') - 10, home.indexOf("</p>", home.indexOf('id="hero-title"')));
    const widths = [...hero.matchAll(/max-w-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    expect(widths.length).toBe(2);
    for (const w of widths) expect(w).toBeLessThanOrEqual(680);
  });

  it("tagline reveal: words start muted at 30% ink, full ink under reduced motion, read once by screen readers", () => {
    const html = renderToStaticMarkup(createElement(TaglineReveal, { text: "Every job comes from the company's own page. Nothing between you and the employer." }));
    expect(html).toContain('<span class="sr-only">Every job comes from the company&#x27;s own page. Nothing between you and the employer.</span>');
    expect(html).toMatch(/<span aria-hidden="true"><span class="kit-word" data-on="false">Every /);
    expect(css).toMatch(/\.kit-word \{ color: color-mix\(in srgb, var\(--text\) 30%, transparent\)/);
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.kit-word \{ color: var\(--text\); transition: none; \}/);
    const src = readFileSync("src/components/marketing/tagline-reveal.tsx", "utf8");
    expect(src).toContain("IntersectionObserver");
    expect(src).toContain("prefers-reduced-motion: reduce");
    expect(src).not.toMatch(/addEventListener\("scroll"/);
  });

  it("header is a floating translucent bar and the mobile stagger is capped at 400ms", () => {
    const h = readFileSync("src/components/marketing/site-header.tsx", "utf8");
    expect(h).toMatch(/fixed inset-x-0 top-0 z-50 px-2 pt-2/);
    expect(h).toMatch(/bg-surface\/80[^"]*backdrop-blur/);
    expect(h).toContain("const STAGGER_MS = 60;");
    expect(h).toContain("const STAGGER_CAP_MS = 400;");
    expect(h).toContain("translate-y-6");
  });

  it("main buttons use 8px vertical and 12px horizontal padding", () => {
    const b = readFileSync("src/components/ui/button.tsx", "utf8");
    expect(b).toMatch(/md: "button-md min-h-11 px-3 py-2"/);
    expect(b).toMatch(/lg: "button-lg min-h-12 px-3 py-2"/);
  });
});
