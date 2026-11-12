import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/layout";

export function FinalCta({ title, body, cta, note }: { title: ReactNode; body?: ReactNode; cta: { href: string; label: string }; note?: ReactNode }) {
  return (
    <Section labelledBy="final-cta-title" tone="inverse" space="lg">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
        <h2 id="final-cta-title" className="heading-3 md:heading-1 lg:col-span-8">{title}</h2>
        <div className="flex flex-col items-start gap-4 lg:col-span-4">
          {body ? <p className="body-3 text-text-inverse">{body}</p> : null}
          <ButtonLink href={cta.href} size="lg" variant="primary" className="border-highlight">{cta.label}</ButtonLink>
          {note ? <p className="caption-2 text-text-inverse">{note}</p> : null}
        </div>
      </div>
    </Section>
  );
}
