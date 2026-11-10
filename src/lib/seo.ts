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

/** Page level openGraph/twitter replace the root ones, so every page must carry the image itself. */
export const ogImageUrl = (): string => absoluteUrl("/opengraph-image");
export const socialImages = () => ({
  openGraph: { images: [{ url: ogImageUrl(), width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image" as const, images: [ogImageUrl()] },
});

export function pageMetadata({ title, description, path, noindex }: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  const full = `${title} · ${product.fullName}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: product.fullName, title: full, description, url, ...socialImages().openGraph },
    twitter: { title: full, description, ...socialImages().twitter },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
