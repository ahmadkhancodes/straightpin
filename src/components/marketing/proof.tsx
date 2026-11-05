import { Section } from "@/components/ui/layout";

/** Proof slot. Ships with visible placeholders: never replace them with invented quotes. */
export function Proof({
  quote = "{{testimonial}}", name = "{{name}}", role = "{{role, company}}",
}: { quote?: string; name?: string; role?: string }) {
  return (
    <Section tone="raised" labelledBy="proof-title">
      <h2 id="proof-title" className="sr-only">What customers say</h2>
      <figure className="grid gap-6 lg:grid-cols-12 lg:gap-16">
        <blockquote className="heading-5 md:heading-3 text-text lg:col-span-8">&ldquo;{quote}&rdquo;</blockquote>
        <figcaption className="flex flex-col gap-1 border-t border-border pt-6 lg:col-span-4 lg:self-end lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <span className="title-3 text-text">{name}</span>
          <span className="body-6 text-text-subtle">{role}</span>
        </figcaption>
      </figure>
    </Section>
  );
}
