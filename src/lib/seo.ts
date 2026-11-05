import type { Metadata } from "next";
import { product } from "@/config/product";

export interface PageMetaInput {
  title: string;
  description: string;
  /** Path starting with a slash, for example "/docs/billing". */
  path: string;
  noindex?: boolean;
}

export function absoluteUrl(path: string): string {
  return new URL(path, product.url).toString();
}

export function pageMetadata({ title, description, path, noindex }: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  const full = `${title} · ${product.fullName}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: product.fullName, title: full, description, url },
    twitter: { card: "summary_large_image", title: full, description },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
