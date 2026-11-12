import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Container } from "@/components/ui/layout";

// Guards for docs/design-brief.md ("the Help Wanted page"). The founder rejected the old cream + terracotta
// + Bricolage look as "typical AI style"; these keep it from drifting back.
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(n)) out.push(p);
  }
  return out;
}
const files = walk("src");
const hits = (re: RegExp) => files.filter((f) => re.test(readFileSync(f, "utf8")));

describe("design system", () => {
  it("loads the brief's type pairing and no generic or old faces", () => {
    const fonts = readFileSync("src/app/fonts.ts", "utf8");
    for (const f of ["Archivo", "Newsreader", "JetBrains_Mono"]) expect(fonts).toContain(f);
    expect(hits(/\b(Inter|Geist|Bricolage_Grotesque|Caveat|Public_Sans|Roboto)\b\s*[,(}]/)).toEqual([]);
  });

  it("has no old cream / terracotta palette, purple or indigo", () => {
    expect(hits(/#(f6f1e9|b8381c|8f2b14|fbe7df)\b/i)).toEqual([]);
    expect(hits(/\b(bg|text|from|to|border)-(indigo|purple|violet)-\d/)).toEqual([]);
  });

  it("uses no background gradients and no pill shapes outside the spinner", () => {
    expect(hits(/linear-gradient|radial-gradient|bg-gradient-/)).toEqual([]);
    const pills = hits(/rounded-full/).filter((f) => !f.endsWith("button.tsx"));
    expect(pills).toEqual([]);
  });

  it("keeps surfaces square and controls at 4px", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/--radius-sm:\s*0px/);
    expect(css).toMatch(/--radius-md:\s*4px/);
  });

  it("Container uses a caller max width instead of fighting the default", () => {
    const narrow = renderToStaticMarkup(Container({ className: "max-w-2xl", children: "x" }));
    expect(narrow).toContain("max-w-2xl");
    expect(narrow).not.toContain("max-w-7xl");
    expect(renderToStaticMarkup(Container({ children: "x" }))).toContain("max-w-7xl");
  });
});
