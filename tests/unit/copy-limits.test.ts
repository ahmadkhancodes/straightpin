import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { product } from "@/config/product";

const FREE = product.plans[0]!.limits;
const FILES = ["src/app/(marketing)/page.tsx", "src/app/(marketing)/pricing/page.tsx", "src/content/compare.ts", "src/components/marketing/field-picker.tsx", "src/config/product.ts"];

describe("free plan numbers written in copy match the real limits", () => {
  it("every '<n> opens/job opens a day' and '<n> saved jobs' sentence equals the config", () => {
    for (const f of FILES) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/\b(\d+) (?:job )?opens a day/g)) expect(Number(m[1]), `${f}: ${m[0]}`).toBe(FREE.opens);
      for (const m of text.matchAll(/\b(\d+) saved jobs/g)) expect(Number(m[1]), `${f}: ${m[0]}`).toBe(FREE.saves);
    }
  });
});
