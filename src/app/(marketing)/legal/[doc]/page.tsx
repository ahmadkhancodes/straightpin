import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDoc } from "@/components/legal/legal-doc";
import { getLegalDoc, legalDocs } from "@/content/legal";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ doc: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return legalDocs.map((d) => ({ doc: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await params;
  const d = getLegalDoc(doc);
  if (!d) return {};
  return pageMetadata({ title: d.title, description: d.description, path: `/legal/${d.slug}` });
}

export default async function LegalPage({ params }: Props) {
  const { doc } = await params;
  const d = getLegalDoc(doc);
  if (!d) notFound();
  return <LegalDoc doc={d} />;
}
