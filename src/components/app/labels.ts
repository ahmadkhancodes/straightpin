import type { MeterId } from "@/config/product";

/** Product-facing names for each meter. A new product edits this map. */
export const METER_LABELS: Record<MeterId, { singular: string; plural: string; period: string }> = {
  submissions: { singular: "submission", plural: "submissions", period: "this month" },
  seats: { singular: "seat", plural: "seats", period: "" },
  recipients: { singular: "recipient", plural: "recipients", period: "" },
  integrations: { singular: "integration", plural: "integrations", period: "" },
  storage_mb: { singular: "MB of storage", plural: "MB of storage", period: "" },
};

export const METERS_SHOWN: MeterId[] = ["submissions", "recipients", "seats"];
export const fmt = (n: number) => new Intl.NumberFormat("en").format(n);
