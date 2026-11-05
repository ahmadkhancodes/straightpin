import type { MeterId } from "@/config/product";

/** Product-facing names for each meter. A new product edits this map. */
export const METER_LABELS: Record<MeterId, { singular: string; plural: string; period: string }> = {
  opens: { singular: "job open", plural: "job opens", period: "today" },
  saves: { singular: "saved job", plural: "saved jobs", period: "" },
};

export const METERS_SHOWN: MeterId[] = ["opens", "saves"];
export const fmt = (n: number) => new Intl.NumberFormat("en").format(n);
