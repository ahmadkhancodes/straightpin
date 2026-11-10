import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/layout";
import { CompareTable } from "@/components/marketing/compare-table";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { comparisonBySlug, comparisons } from "@/content/compare";
import { socialImages } from "@/lib/seo";
import { product } from "@/config/product";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return comparisons.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = comparisonBySlug(slug);
  if (!entry) return {};
  return {
    title: entry.title,
    description: entry.description,
    alternates: { canonical: `/compare/${entry.slug}` },
    openGraph: { title: entry.title, description: entry.description, url: `/compare/${entry.slug}`, ...socialImages().openGraph },
    twitter: { title: entry.title, ...socialImages().twitter },
  };
}

export default async function ComparePage({ params }: Props) {
  const { slug } = await params;
  const entry = comparisonBySlug(slug);
  if (!entry) notFound();

  return (
    <>
      <Section labelledBy="compare-title">
        <div className="flex max-w-2xl flex-col items-start gap-6">
          <h1 id="compare-title" className="heading-3 md:heading-1">{entry.headline}</h1>
          <p className="body-3 text-text-subtle md:title-1">{entry.intro}</p>
          <ButtonLink href="/sign-in" size="lg">Start free</ButtonLink>
          <p className="caption-2 text-text-subtle">Prices checked {entry.checked}.</p>
        </div>
        <div className="mt-12 md:mt-16">
          <CompareTable
            caption={`${product.name} compared with ${entry.competitor}`}
            columns={[entry.competitor, product.name]}
            highlightColumn={1}
            rows={entry.rows.map((r) => ({ label: r.label, values: [...r.values] }))}
          />
        </div>
        <p className="body-6 mt-6 max-w-2xl text-text-subtle">{entry.fitNote}</p>
        <p className="caption-2 mt-4 text-text-subtle">
          Sources:{" "}
          {entry.sources.map((s) => (
            <a key={s.url} href={s.url} rel="noopener noreferrer" className="underline underline-offset-4 focus-visible:focus-ring">{s.label}</a>
          ))}
        </p>
      </Section>
      <Faq title="Common questions" items={entry.faq} />
      <FinalCta
        title="Pick your field. See what is open today."
        body="Free to start. Then $10.99 a month, or $4.99 a week. Cancel in two taps. 7 day refund."
        cta={{ href: "/sign-in", label: "Start free" }}
        note="No card needed to start."
      />
    </>
  );
}
