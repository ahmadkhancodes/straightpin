import type { ReactNode } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";

export interface HeroProps {
  title: ReactNode;
  subtitle: ReactNode;
  primaryCta: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  proof?: ReactNode;
  /** The REAL product UI. Cropped by its own container on mobile. */
  visual: ReactNode;
}

/** Left-aligned hero: claim, one action, proof next to it, then the product itself. */
export function Hero({ title, subtitle, primaryCta, secondaryCta, proof, visual }: HeroProps) {
  return (
    <section aria-labelledby="hero-title" className="bg-surface pb-12 pt-12 md:pb-24 md:pt-20">
      <Container>
        <div className="flex max-w-2xl flex-col items-start gap-6">
          <h1 id="hero-title" className="hero-gradient-text heading-3 md:heading-1">{title}</h1>
          <p className="body-3 text-text-subtle md:title-1">{subtitle}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <ButtonLink href={primaryCta.href} size="lg">{primaryCta.label}</ButtonLink>
            {secondaryCta ? (
              <Link href={secondaryCta.href} className="inline-flex min-h-11 items-center rounded-sm button-md text-text underline underline-offset-4 transition-colors duration-300 ease-out-kit hover:text-action focus-visible:focus-ring">
                {secondaryCta.label}
              </Link>
            ) : null}
          </div>
          {proof ? <div className="caption-2 text-text-subtle">{proof}</div> : null}
        </div>
        <div className="mt-12 md:mt-16">{visual}</div>
      </Container>
    </section>
  );
}
