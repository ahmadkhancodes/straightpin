import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/layout";

export function FinalCta({ title, body, cta, note }: { title: ReactNode; body?: ReactNode; cta: { href: string; label: string }; note?: ReactNode }) {
  return (
    <Section labelledBy="final-cta-title">
      <div className="flex flex-col items-start gap-6 rounded-lg bg-surface-inverse p-8 text-text-inverse md:p-16">
        <h2 id="final-cta-title" className="heading-4 md:heading-2 max-w-3xl">{title}</h2>
        {body ? <p className="body-3 max-w-2xl opacity-80">{body}</p> : null}
        <div className="flex flex-wrap items-center gap-4">
          <ButtonLink href={cta.href} size="lg" variant="secondary" className="border-transparent">{cta.label}</ButtonLink>
          {note ? <p className="caption-2 opacity-80">{note}</p> : null}
        </div>
      </div>
    </Section>
  );
}
