"use client";
import Link from "next/link";
import { useState } from "react";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";
import { fieldById, jobsForField, sampleFields, type FieldId } from "@/content/sample-jobs";
import { NoticeCard } from "./notice-card";

/** Counter that shows the digits of the sample match count. The digits ride a 240ms transform, reduced motion jumps. */
function Counter({ value }: { value: number }) {
  return (
    <span aria-hidden className="inline-flex gap-0.5">
      {String(value).split("").map((d, i) => (
        <span key={`${i}-${d}`} className="digit-flip heading-5 figures min-w-7 border border-rule bg-surface-raised px-1 text-center text-text">{d}</span>
      ))}
    </span>
  );
}

/** Hero companion: chips with sample counts, a live counter, and (when `withList`) the matches preview. */
export type RealCounts = Partial<Record<FieldId, { count: number; agencyHidden: number }>>;

export function FieldPicker({ withList = false, headingId, real }: { withList?: boolean; headingId: string; /** Real counts from the job database. Without them the chips show clearly labelled example numbers. */ real?: RealCounts }) {
  const [field, setField] = useState<FieldId>("support");
  const base = fieldById(field);
  const r = real?.[field];
  const current = r ? { ...base, count: r.count, agencyRemoved: r.agencyHidden } : base;
  const chipCount = (id: FieldId, fallback: number) => real?.[id]?.count ?? fallback;
  const jobs = jobsForField(field);
  return (
    <div>
      <div role="group" aria-labelledby={headingId} className="flex flex-wrap gap-2">
        {sampleFields.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={field === f.id}
            onClick={() => setField(f.id)}
            className={cn(
              "button-sm inline-flex min-h-12 items-center gap-2 rounded-md border px-4 py-2 transition-colors duration-300 ease-out-kit focus-visible:focus-ring",
              field === f.id ? "border-rule bg-highlight text-on-highlight" : "border-border-strong bg-surface-raised text-text hover:border-rule",
            )}
          >
            {f.label}
            <span className={cn("caption-5 figures", field === f.id ? "text-on-highlight" : "text-text-subtle")}>{chipCount(f.id, f.count)}</span>
          </button>
        ))}
      </div>
      <p className="mt-6 flex items-center gap-3" aria-live="polite">
        <Counter value={current.count} />
        <span className="body-6 text-text">
          <b className="font-semibold">matches {real ? "right now" : "so far"}</b>{" "}
          <span className="text-text-subtle">for {current.label}. {current.agencyRemoved} staffing agency posts removed.{real ? "" : " Example numbers."}</span>
        </span>
      </p>
      <p className="mt-3">
        <Link href={`/quiz?field=${field}`} className="button-md inline-flex min-h-12 items-center text-action underline decoration-2 underline-offset-4 focus-visible:focus-ring">
          Answer five more questions for your real count
        </Link>
      </p>
      {withList ? (
        <div className="mt-8 border-y border-rule bg-surface-raised">
          <p className="flex items-start gap-2 border-b border-border px-4 py-3 body-6 text-text">
            <ShieldCheck size={20} weight="bold" aria-hidden className="mt-0.5 shrink-0 text-marker" />
            <span>
              <span className="kicker mr-2 text-marker">Receipt</span><b className="font-semibold">We removed {current.agencyRemoved} staffing agency posts from this list.</b>{" "}
              <span className="text-text-subtle">{real ? "Illustration." : "Example."}</span>
            </span>
          </p>
          <ul className="grid grid-cols-1 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            {jobs.map((j, i) => (
              <li key={j.id} className="min-w-0"><NoticeCard job={j} showTear={false} selected={i === 0} framed={false} /></li>
            ))}
          </ul>
          <p className="caption-2 border-t border-border px-4 py-3 text-text-subtle">Free: 5 job opens a day. The notices below illustrate the layout; the companies are made up.</p>
        </div>
      ) : null}
    </div>
  );
}
