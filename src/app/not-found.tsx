import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/layout";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="pt-20">
        <Section labelledBy="nf-title">
          <div className="flex min-h-96 max-w-2xl flex-col items-start justify-center gap-6">
            <p className="caption-3 text-text-subtle">Error 404</p>
            <h1 id="nf-title" className="heading-3 md:heading-1 text-text">This page did not arrive</h1>
            <p className="body-3 text-text-subtle">The link may be old or mistyped. Head back home, or read the docs.</p>
            <div className="flex flex-wrap items-center gap-4">
              <ButtonLink href="/" size="lg">Back to home</ButtonLink>
              <ButtonLink href="/docs" size="lg" variant="secondary">Read the docs</ButtonLink>
            </div>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
