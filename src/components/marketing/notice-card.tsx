"use client";
import { useState } from "react";
import { ArrowRight, Warning } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";
import type { SampleJob } from "@/content/sample-jobs";

const OLD_DAYS = 30;

const repostText = (n: number) => (n === 0 ? "Never reposted" : n === 1 ? "Reposted once" : `Reposted ${n} times`);

/**
 * A job as a paper notice. Sample data only in M1. The tear off tab is the signature move: a transform only
 * 160ms slide, then (in the real app) the employer page opens. Here it only plays the motion.
 */
export function NoticeCard({ job, selected, showTear = true }: { job: SampleJob; selected?: boolean; showTear?: boolean }) {
  const [torn, setTorn] = useState(false);
  const old = job.postedDays > OLD_DAYS;
  return (
    <article
      className={cn(
        "min-w-0 rounded-sm border bg-surface-raised transition-shadow duration-300 ease-out-kit lift-on-hover",
        selected ? "border-action ring-1 ring-action" : "border-border",
      )}
    >
      <div className="p-4">
        {job.tag ? (
          <span className="caption-3 inline-block rounded-sm bg-highlight px-1 text-on-highlight">
            {job.tag === "direct" ? "Direct to company" : "New today"}
          </span>
        ) : null}
        <h3 className={cn("heading-6 text-text", job.tag ? "mt-2" : "")}>{job.title}</h3>
        <p className="body-6 mt-1 text-text-subtle">{job.company} · {job.place} · {job.pay}</p>
        <p className="body-6 mt-3 flex flex-wrap gap-x-3 gap-y-1 text-text-subtle">
          <span className="body-4 text-text">Posted {job.posted}</span>
          <span>{repostText(job.reposts)}</span>
          {showTear ? <span>Checked {job.checked}</span> : <span className="self-center font-mono text-xs">{job.host}</span>}
        </p>
        {old ? (
          <p className="mt-3 flex items-center gap-2">
            <Warning size={16} weight="regular" aria-hidden className="text-warning" />
            <span className="font-note text-lg leading-5 text-warning" aria-hidden>Old posting</span>
            <span className="sr-only">Old posting.</span>
            <span className="caption-3 text-warning">{job.postedDays} days</span>
          </p>
        ) : null}
      </div>
      {showTear ? (
        <button
          type="button"
          onClick={() => {
            setTorn(true);
            if (typeof navigator !== "undefined") navigator.vibrate?.(10);
            window.setTimeout(() => setTorn(false), 600);
          }}
          className="group flex min-h-12 w-full items-center justify-between gap-3 overflow-hidden border-t-[1.5px] border-dashed border-border bg-brand-tint px-4 py-2 text-left text-action focus-visible:focus-ring"
        >
          <span
            className={cn(
              "button-sm inline-flex items-center gap-2 whitespace-nowrap transition-transform duration-tear ease-out-kit motion-reduce:transition-none group-hover:translate-x-1",
              torn && "tear-open",
            )}
          >
            <ArrowRight size={20} weight="regular" aria-hidden />
            Apply at company
          </span>
          <span className="min-w-0 truncate font-mono text-xs text-text-subtle">{job.host}{job.path}</span>
          <span className="sr-only">for {job.title} (sample notice, opens nothing)</span>
        </button>
      ) : null}
    </article>
  );
}
