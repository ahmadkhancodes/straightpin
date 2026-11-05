import type { MeterId } from "@/config/product";
import { UNLIMITED } from "@/config/product";

/** Product-facing names for each meter. */
export const METER_LABELS: Record<MeterId, { singular: string; plural: string; period: string }> = {
  opens_day: { singular: "free job open", plural: "free job opens", period: "today" },
  saved_jobs: { singular: "saved job", plural: "saved jobs", period: "" },
  followed_companies: { singular: "followed company", plural: "followed companies", period: "" },
  instant_alerts: { singular: "instant alert", plural: "instant alerts", period: "" },
};

export const METERS_SHOWN: MeterId[] = ["opens_day", "saved_jobs"];
export const fmt = (n: number) => (n >= UNLIMITED ? "Unlimited" : new Intl.NumberFormat("en").format(n));
