import type { MetadataRoute } from "next";
import { compareEntries } from "@/content/compare";
import { docs } from "@/content/docs";
import { legalDocs } from "@/content/legal";
import { product } from "@/config/product";

export default function sitemap(): MetadataRoute.Sitemap {
  const u = (path: string) => `${product.url}${path}`;
  const now = new Date(product.legal.effectiveDate);
  return [
    { url: u("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: u("/pricing"), lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: u("/docs"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ...docs.map((d) => ({ url: u(`/docs/${d.slug}`), lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...compareEntries.map((c) => ({ url: u(`/compare/${c.slug}`), lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...legalDocs.map((d) => ({ url: u(`/legal/${d.slug}`), lastModified: now, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
