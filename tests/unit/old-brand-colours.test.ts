import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regression: server-rendered side pages and e-mails kept the pre-redesign red button and 8px radius.
const FILES = ["src/app/api/jobs/[id]/open/route.ts", "src/app/api/mail/unsubscribe/route.ts", "src/lib/mail/templates.ts"];
describe("old brand leftovers", () => {
  for (const f of FILES) {
    it(`${f} has no old red, grey page or rounded 8px surfaces`, () => {
      const src = readFileSync(f, "utf8").toLowerCase();
      for (const bad of ["#b3260e", "#b8381c", "#f6f1e9", "#f7f7f7", "border-radius:8px", "border-radius:6px"]) expect(src, bad).not.toContain(bad);
    });
  }
});
