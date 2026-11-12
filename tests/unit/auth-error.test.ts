import { describe, expect, it } from "vitest";
import { authError } from "@/components/app/api";

describe("authError", () => {
  it("never shows a developer validation message", () => {
    expect(authError({ code: "VALIDATION_ERROR", message: "[body.email] Invalid email address", status: 400 }, "Fallback.")).toBe("Fallback.");
    expect(authError({ message: "[body.email] Invalid email address" }, "Fallback.")).toBe("Fallback.");
  });
  it("keeps plain messages, maps 429, ignores null", () => {
    expect(authError({ message: "Invalid token" })).toBe("Invalid token");
    expect(authError({ status: 429 })).toMatch(/Too many/);
    expect(authError(null)).toBeNull();
  });
});
