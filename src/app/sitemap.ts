import type { MetadataRoute } from "next";
import { compareEntries } from "@/content/compare";
import { docs } from "@/content/docs";
import { legalDocs } from "@/content/legal";
import { product } from "@/config/product";
import { getDb } from "@/lib/db";
import { generatePagesCached, pagePath } from "@/lib/jobs/seoPages";

/** Rendered per request (the job page combinations follow the database), with a 5 minute cache inside generatePagesCached. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const u = (path: string) => `${product.url}${path}`;
  const now = new Date(product.legal.effectiveDate);
  const combos = await getDb().then((db) => generatePagesCached(db)).catch(() => []);
  return [
    { url: u("/jobs"), lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    ...combos.map((c) => ({ url: u(pagePath(c.field, c.location)), lastModified: new Date(), changeFrequency: "daily" as const, priority: c.location.kind === "city" ? 0.6 : 0.7 })),
    { url: u("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: u("/pricing"), lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: u("/how-we-check"), lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: u("/bot"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: u("/about/data"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: u("/docs"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ...docs.map((d) => ({ url: u(`/docs/${d.slug}`), lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...compareEntries.map((c) => ({ url: u(`/compare/${c.slug}`), lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...legalDocs.map((d) => ({ url: u(`/legal/${d.slug}`), lastModified: now, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
