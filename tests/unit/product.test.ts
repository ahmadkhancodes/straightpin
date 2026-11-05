import { describe, expect, it } from "vitest";
import { allLookupKeys, planById, product } from "@/config/product";

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
