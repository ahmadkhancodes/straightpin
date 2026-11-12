"use client";
import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";
import type { SampleJob } from "@/content/sample-jobs";
import { DirectStamp, MetaLine, OldPostingNote } from "@/components/jobs/listing-parts";

const OLD_DAYS = 30;

const repostText = (n: number) => (n === 0 ? "Never reposted" : n === 1 ? "Reposted once" : `Reposted ${n} times`);

/**
 * A sample job as one listing in a classifieds column (labelled sample data). The tear off tab is the signature
 * move: a perforated strip that slides 6px (transform only, 160ms); in the real app the employer page opens.
 */
export function NoticeCard({ job, selected, showTear = true, framed = true }: { job: SampleJob; selected?: boolean; showTear?: boolean; framed?: boolean }) {
  const [torn, setTorn] = useState(false);
  const old = job.postedDays > OLD_DAYS;
  return (
    <article
      className={cn(
        "min-w-0 bg-surface-raised transition-colors duration-300 ease-out-kit",
        framed && "border border-border lift-on-hover",
        selected && "bg-brand-tint",
      )}
    >
      <div className="px-4 py-4">
        <div className="flex flex-col gap-x-4 gap-y-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {job.tag ? <DirectStamp label={job.tag === "direct" ? "Direct to company" : "New today"} /> : null}
            <h3 className={cn("title-2 font-semibold text-text", job.tag ? "mt-2" : "")}>{job.title}</h3>
            <p className="body-6 mt-0.5 text-text-subtle">{job.company} · {job.place}</p>
          </div>
          <p className="body-5 figures shrink-0 text-text">{job.pay}</p>
        </div>
        <MetaLine posted={`Posted ${job.posted}`} reposts={repostText(job.reposts)} extra={showTear ? `Checked ${job.checked}` : undefined} host={showTear ? undefined : job.host} />
        {old ? <div className="mt-2"><OldPostingNote days={job.postedDays} /></div> : null}
      </div>
      {showTear ? (
        <button
          type="button"
          onClick={() => {
            setTorn(true);
            if (typeof navigator !== "undefined") navigator.vibrate?.(10);
            window.setTimeout(() => setTorn(false), 600);
          }}
          className="group flex min-h-12 w-full items-center justify-between gap-3 overflow-hidden border-t-[1.5px] border-dashed border-border-strong px-4 py-2 text-left text-text hover:bg-brand-tint focus-visible:focus-ring"
        >
          <span
            className={cn(
              "button-sm inline-flex items-center gap-2 whitespace-nowrap underline-offset-4 transition-transform duration-tear ease-out-kit group-hover:translate-x-1 group-hover:underline motion-reduce:transition-none",
              torn && "tear-open",
            )}
          >
            <ArrowRight size={18} weight="bold" aria-hidden />
            Apply at company
          </span>
          <span className="caption-5 min-w-0 truncate font-mono text-text-subtle">{job.host}{job.path}</span>
          <span className="sr-only">for {job.title} (sample notice, opens nothing)</span>
        </button>
      ) : null}
    </article>
  );
}
