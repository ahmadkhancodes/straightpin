import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeBlock } from "@/components/docs/code-block";
import { DocsNav } from "@/components/docs/docs-nav";
import { Container } from "@/components/ui/layout";
import { docGroups, docs, getDoc, sectionId } from "@/content/docs";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return docs.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = getDoc(slug);
  if (!d) return {};
  return pageMetadata({ title: d.title, description: d.description, path: `/docs/${d.slug}` });
}

export default async function DocPageRoute({ params }: Props) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  const groups = docGroups.map((g) => ({ title: g.title, items: g.docs.map((d) => ({ slug: d.slug, title: d.title })) }));

  return (
    <Container className="py-12 md:py-20">
      <div className="grid gap-8 lg:grid-cols-4 lg:gap-12">
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <DocsNav groups={groups} current={doc.slug} />
          </div>
        </aside>
        <article className="flex min-w-0 flex-col gap-8 lg:col-span-2">
          <header className="flex flex-col gap-3">
            <p className="caption-2 text-text-muted">
              <Link href="/docs" className="underline underline-offset-4 hover:text-text focus-visible:focus-ring">Docs</Link>
            </p>
            <h1 className="heading-4 text-text">{doc.title}</h1>
            <p className="body-3 text-text-subtle">{doc.description}</p>
          </header>
          {doc.sections.map((s) => (
            <section key={s.heading} id={sectionId(s.heading)} aria-labelledby={`${sectionId(s.heading)}-h`} className="flex scroll-mt-24 flex-col gap-4">
              <h2 id={`${sectionId(s.heading)}-h`} className="heading-6 text-text">{s.heading}</h2>
              {s.body.map((para) => (
                <p key={para} className="body-3 text-text-subtle">{para}</p>
              ))}
              {s.code ? <CodeBlock code={s.code.code} lang={s.code.lang} /> : null}
            </section>
          ))}
        </article>
        <nav aria-label="On this page" className="hidden lg:col-span-1 lg:block">
          <div className="sticky top-24 flex flex-col gap-2">
            <p className="caption-3 text-text-muted">On this page</p>
            <ul className="flex flex-col">
              {doc.sections.map((s) => (
                <li key={s.heading}>
                  <a href={`#${sectionId(s.heading)}`} className="body-6 flex min-h-8 items-center text-text-subtle hover:text-text focus-visible:focus-ring">
                    {s.heading}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
    </Container>
  );
}
