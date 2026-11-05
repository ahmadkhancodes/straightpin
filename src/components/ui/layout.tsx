import type { ReactNode } from "react";
import { cn } from "./cn";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

/** Marketing section: 48-64px mobile, 80-96px desktop vertical padding. Pass `tone` to step the surface. */
export function Section({ id, tone = "base", className, children, labelledBy }: { id?: string; tone?: "base" | "raised" | "inverse"; className?: string; children: ReactNode; labelledBy?: string }) {
  const t = { base: "bg-surface", raised: "bg-surface-raised", inverse: "bg-surface-inverse text-text-inverse" }[tone];
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("py-12 md:py-24", t, className)}>
      <Container>{children}</Container>
    </section>
  );
}
