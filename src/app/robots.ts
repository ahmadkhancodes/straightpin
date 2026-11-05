import type { MetadataRoute } from "next";
import { product } from "@/config/product";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/app/", "/admin/"] },
    sitemap: `${product.url}/sitemap.xml`,
  };
}
