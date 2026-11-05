import type { ReactNode } from "react";
import { Section } from "@/components/ui/layout";
import { Reveal } from "@/components/ui/reveal";

export interface ProblemItem {
  /** The pain in the buyer's own words. */
  pain: string;
  detail: ReactNode;
}

/** Asymmetric: a narrow sticky statement on the left, the evidence list running down the right. */
export function Problem({ title, intro, items }: { title: ReactNode; intro?: ReactNode; items: ProblemItem[] }) {
  return (
    <Section tone="raised" labelledBy="problem-title">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
          <h2 id="problem-title" className="heading-4 md:heading-2 text-text">{title}</h2>
          {intro ? <p className="body-3 text-text-subtle">{intro}</p> : null}
        </div>
        <ul className="flex flex-col lg:col-span-6 lg:col-start-7">
          {items.map((item) => (
            <li key={item.pain} className="border-t border-border py-6 first:border-t-0 first:pt-0 lg:first:border-t lg:first:pt-6">
              <Reveal>
                <p className="heading-6 text-text">&ldquo;{item.pain}&rdquo;</p>
                <p className="body-3 mt-2 text-text-subtle">{item.detail}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
