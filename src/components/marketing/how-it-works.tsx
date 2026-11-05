import type { ReactNode } from "react";
import { Section } from "@/components/ui/layout";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/components/ui/cn";

export interface Step {
  title: string;
  body: ReactNode;
  /** A UI fragment or code sample, not an icon. */
  visual: ReactNode;
}

export function HowItWorks({ title, steps }: { title: ReactNode; steps: Step[] }) {
  return (
    <Section labelledBy="how-title">
      <h2 id="how-title" className="heading-4 md:heading-2 max-w-2xl text-text">{title}</h2>
      <ol className="mt-12 flex flex-col gap-16 md:mt-16 md:gap-24">
        {steps.map((step, i) => (
          <li key={step.title}>
            <Reveal className="grid items-center gap-6 lg:grid-cols-12 lg:gap-16">
              <div className={cn("flex flex-col gap-3 lg:col-span-5", i % 2 === 1 && "lg:order-2 lg:col-start-8")}>
                <p aria-hidden className="heading-2 tabular-nums text-text-muted">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="heading-5 text-text"><span className="sr-only">Step {i + 1}: </span>{step.title}</h3>
                <p className="body-3 text-text-subtle">{step.body}</p>
              </div>
              <div className={cn("min-w-0 lg:col-span-7", i % 2 === 1 && "lg:order-1 lg:col-start-1")}>{step.visual}</div>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
