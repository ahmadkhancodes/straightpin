import type { ReactNode } from "react";
import { cn } from "./cn";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  // `cn` does not merge classes, so a caller max-w-* replaces the default instead of fighting it in CSS order.
  const width = className?.split(/\s+/).some((c) => c.startsWith("max-w-")) ? null : "max-w-7xl";
  return <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", width, className)}>{children}</div>;
}

/**
 * Marketing section. `space` varies the rhythm on purpose (sm 48/64, md 48/80, lg 64/96) so the page does not
 * repeat one padding. `head` prints a small caps section head on a 2px ink rule, like a broadsheet section.
 */
export function Section({ id, tone = "base", space = "md", head, className, children, labelledBy }: { id?: string; tone?: "base" | "raised" | "inverse"; space?: "sm" | "md" | "lg"; head?: ReactNode; className?: string; children: ReactNode; labelledBy?: string }) {
  const t = { base: "bg-surface", raised: "bg-surface-raised", inverse: "bg-surface-inverse text-text-inverse" }[tone];
  const s = { sm: "py-12 md:py-16", md: "py-12 md:py-20", lg: "py-16 md:py-24" }[space];
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn(s, t, className)}>
      <Container>
        {head ? <SectionHead>{head}</SectionHead> : null}
        {children}
      </Container>
    </section>
  );
}

/** Small caps head on a 2px rule. */
export function SectionHead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("kicker mb-8 border-t-2 border-current pt-3 md:mb-12", className)}>{children}</p>;
}
