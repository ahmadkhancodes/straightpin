import Link from "next/link";
import { Container } from "@/components/ui/layout";
import { docGroups } from "@/content/docs";
import { product } from "@/config/product";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Documentation",
  description: `Guides and reference for the ${product.name} API, authentication, billing and webhooks.`,
  path: "/docs",
});

export default function DocsIndexPage() {
  return (
    <Container className="py-12 md:py-20">
      <header className="mb-12 flex max-w-3xl flex-col gap-3">
        <h1 className="heading-4 text-text">Documentation</h1>
        <p className="body-3 text-text-subtle">Everything you need to connect {product.name} to your sites and systems.</p>
      </header>
      <div className="flex flex-col gap-12">
        {docGroups.map((g) => (
          <section key={g.title} aria-labelledby={`g-${g.title}`} className="flex flex-col gap-4">
            <h2 id={`g-${g.title}`} className="title-2 text-text">{g.title}</h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {g.docs.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/docs/${d.slug}`}
                    className="flex h-full flex-col gap-1 rounded-md border border-border bg-surface p-4 hover:bg-surface-raised focus-visible:focus-ring"
                  >
                    <span className="title-3 text-text">{d.title}</span>
                    <span className="body-6 text-text-subtle">{d.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Container>
  );
}
