import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css|mjs)$/.test(n)) out.push(p);
  }
  return out;
}
const files = [...walk("src"), ...walk("scripts")];
const hits = (re: RegExp) => files.filter((f) => re.test(readFileSync(f, "utf8")));

describe("light only: dark mode must not come back", () => {
  it("has no dark: utilities", () => expect(hits(/(^|[\s"'`:])dark:[a-z\[!-]/m)).toEqual([]));
  it("has no prefers-color-scheme: dark", () => expect(hits(/prefers-color-scheme\s*:\s*dark/)).toEqual([]));
  it("has no data-theme, .dark token sets or dark variant", () => {
    expect(hits(/data-theme|dataset\.theme|@custom-variant dark|\[data-theme|:root\.dark|\.dark\s*\{/)).toEqual([]);
  });
  it("has no theme toggle, init script or stored theme key", () => {
    expect(existsSync("src/components/theme.tsx")).toBe(false);
    expect(hits(/ThemeToggle|themeInitScript|theme-script|localStorage\.(get|set)Item\(["']theme/)).toEqual([]);
  });
  it("declares color-scheme: light and one theme-color", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/color-scheme:\s*light/);
    expect(css).not.toMatch(/color-scheme:\s*dark/);
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toMatch(/themeColor:\s*"#/);
  });
});
