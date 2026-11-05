import type { ReactNode } from "react";
import { Section } from "@/components/ui/layout";
import { cn } from "@/components/ui/cn";

export type FeatureSpan = 2 | 3 | 4 | 6;
export interface Feature {
  title: string;
  body: ReactNode;
  /** Columns out of 6 on desktop. Default 2. Mix spans so rows are never three equal cards. */
  span?: FeatureSpan;
  visual?: ReactNode;
}

const spans: Record<FeatureSpan, string> = {
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  6: "md:col-span-6",
};

/** Bento grid on a 6-column track. Items with a visual put it above the copy. */
export function Features({ title, intro, items }: { title: ReactNode; intro?: ReactNode; items: Feature[] }) {
  return (
    <Section tone="raised" labelledBy="features-title">
      <div className="flex max-w-2xl flex-col gap-4">
        <h2 id="features-title" className="heading-4 md:heading-2 text-text">{title}</h2>
        {intro ? <p className="body-3 text-text-subtle">{intro}</p> : null}
      </div>
      <ul className="mt-12 grid gap-4 md:mt-16 md:grid-cols-6">
        {items.map((f) => (
          <li
            key={f.title}
            className={cn(
              "flex min-w-0 flex-col justify-between gap-6 rounded-lg border border-border bg-surface p-6 transition-colors duration-300 ease-out-kit hover:border-border-strong md:p-8",
              spans[f.span ?? 2],
            )}
          >
            {f.visual ? <div className="min-w-0 overflow-hidden rounded-md border border-border bg-surface-raised">{f.visual}</div> : null}
            <div className="flex flex-col gap-2">
              <h3 className="heading-6 text-text">{f.title}</h3>
              <p className="body-3 text-text-subtle">{f.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
