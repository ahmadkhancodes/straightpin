import { product } from "@/config/product";
import type { LegalBlock, LegalDoc as LegalDocData } from "@/content/legal";
import { Container } from "@/components/ui/layout";

const placeholder = /(\{\{[^}]+\}\})/g;

/** Renders text, highlighting unresolved {{placeholders}} so they are visible before launch. */
function Text({ children }: { children: string }) {
  return (
    <>
      {children.split(placeholder).map((part, i) =>
        part.startsWith("{{") ? (
          <mark key={i} className="rounded-md bg-warning-surface px-1 text-text">{part}</mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return (
      <p className="body-3 text-text-subtle">
        <Text>{block}</Text>
      </p>
    );
  }
  if ("list" in block) {
    return (
      <ul className="body-3 flex list-disc flex-col gap-2 pl-6 text-text-subtle">
        {block.list.map((item) => (
          <li key={item}>
            <Text>{item}</Text>
          </li>
        ))}
      </ul>
    );
  }
  const { head, rows } = block.table;
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="body-6 w-full border-collapse text-left">
        <thead className="bg-surface-raised text-text">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="title-4 px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")} className="border-t border-border">
              {row.map((cell, i) => (
                <td key={i} className="px-4 py-3 align-top text-text-subtle">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalDoc({ doc }: { doc: LegalDocData }) {
  const formatted = new Date(`${product.legal.effectiveDate}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <Container className="py-12 md:py-20">
      <article className="mx-auto max-w-3xl">
        <header className="flex flex-col gap-3 border-b border-border pb-8">
          <h1 className="heading-4 text-text">{doc.title}</h1>
          <p className="body-3 text-text-subtle">{doc.description}</p>
          <p className="caption-2 text-text-muted">
            Last updated <time dateTime={product.legal.effectiveDate}>{formatted}</time>
          </p>
        </header>
        <nav aria-label="Table of contents" className="my-8 rounded-md border border-border bg-surface-raised p-4">
          <h2 className="title-4 mb-3 text-text">On this page</h2>
          <ol className="body-6 flex list-decimal flex-col gap-1 pl-6 text-text-subtle">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-11 items-center text-action underline underline-offset-4 hover:text-action-hover focus-visible:focus-ring sm:min-h-8">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex flex-col gap-12">
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="flex scroll-mt-24 flex-col gap-4">
              <h2 id={`${s.id}-h`} className="heading-6 text-text">{s.title}</h2>
              {s.body.map((b, i) => (
                <Block key={i} block={b} />
              ))}
            </section>
          ))}
        </div>
      </article>
    </Container>
  );
}
