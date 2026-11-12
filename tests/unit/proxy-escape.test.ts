import { describe, expect, it } from "vitest";
import { hasBrokenEscape } from "@/proxy";

describe("hasBrokenEscape", () => {
  it("flags a lone % and truncated escapes only", () => {
    for (const p of ["/job/%E0%A4%A", "/docs/100%", "/a/%zz"]) expect(hasBrokenEscape(p), p).toBe(true);
    for (const p of ["/job/abc", "/jobs/caf%C3%A9", "/a%20b", "/"]) expect(hasBrokenEscape(p), p).toBe(false);
  });
});
