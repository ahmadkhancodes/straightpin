import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Section } from "@/components/ui/layout";

export interface FaqItem {
  q: string;
  /** Plain text: reused verbatim in the FAQPage JSON-LD. */
  a: string;
}

export function Faq({ title = "Questions, answered", items }: { title?: string; items: FaqItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
  return (
    <Section labelledBy="faq-title">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <h2 id="faq-title" className="heading-4 md:heading-2 text-text lg:col-span-4">{title}</h2>
        <div className="lg:col-span-8">
          {items.map((item) => (
            <details key={item.q} className="group border-t border-border last:border-b">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 title-2 text-text transition-colors duration-300 ease-out-kit hover:text-action focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus size={20} weight="regular" aria-hidden className="shrink-0 transition-transform duration-300 ease-out-kit group-open:rotate-45" />
              </summary>
              <p className="body-3 max-w-2xl pb-6 text-text-subtle">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </Section>
  );
}
