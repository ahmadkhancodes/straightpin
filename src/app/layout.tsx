import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { product } from "@/config/product";
import { themeInitScript } from "@/components/theme";
import { mono, sans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(product.url),
  title: { default: `${product.fullName}: ${product.tagline}`, template: `%s · ${product.fullName}` },
  description: product.description,
  applicationName: product.fullName,
  openGraph: { type: "website", siteName: product.fullName, url: product.url },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#181818" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:focus-ring">Skip to content</a>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
