import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { allLookupKeys, planById, product } from "@/config/product";
import { billing as billingDocs } from "@/content/docs/billing";
import { refunds } from "@/content/legal/refunds";

describe("product plans match docs/brief.md", () => {
  const price = (id: string, interval: string) => planById(id)?.prices.find((p) => p.interval === interval)?.usd;
  it("has the brief's prices in cents", () => {
    expect(price("weekly", "week")).toBe(499);
    expect(price("monthly", "month")).toBe(1099);
    expect(price("lifetime", "once")).toBe(2399);
    expect(price("plus", "month")).toBe(1999);
    expect(price("plus", "year")).toBe(9899);
    expect(planById("free")?.limits).toEqual({ opens: 5, saves: 10 });
    expect(product.refundDays).toBe(7);
  });
  it("uses straightpin_ lookup keys", () => {
    expect(allLookupKeys().sort()).toEqual([
      "straightpin_lifetime_once", "straightpin_monthly_month", "straightpin_plus_month", "straightpin_plus_year", "straightpin_weekly_week",
    ]);
  });
});

describe("public claims match the code (docs/REVIEW.md)", () => {
  const read = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");
  it("P0-5: the refund policy states the once per customer rule the code enforces", () => {
    const text = JSON.stringify(refunds) + JSON.stringify(billingDocs);
    expect(text).toMatch(/once per customer|refund once/i);
    expect(text).not.toMatch(/every payment/i);
    expect(read("src/lib/billing/lifecycle.ts")).toContain("refund_already_used");
  });
  it("P0-6: the hero does not claim a source count we do not have", () => {
    expect(read("src/app/(marketing)/page.tsx")).not.toMatch(/thousands of company/i);
  });
  it("P0-3: the crawl transport never follows redirects itself", () => {
    expect(read("src/lib/jobs/transport.ts")).toContain('redirect: "manual"');
  });
});

