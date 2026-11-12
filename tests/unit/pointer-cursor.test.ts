import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("clickable elements show the hand cursor", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  it("sets cursor: pointer on enabled buttons and not-allowed on disabled ones", () => {
    expect(css).toMatch(/button:not\(:disabled\)[\s\S]*?cursor:\s*pointer/);
    expect(css).toMatch(/button:disabled[\s\S]*?cursor:\s*not-allowed/);
  });
});
