import Link from "next/link";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";
import { formatPay, placeOf, postedInfo, repostText } from "@/lib/jobs/format";
import type { JobDoc } from "@/lib/jobs/types";

/** Direct to company: the job came from the employer's own board or page and was not flagged as an agency post. */
export const isDirect = (j: Pick<JobDoc, "agencyFlag">) => j.agencyFlag === "no";

export function OldPostingNote({ days }: { days: number }) {
  return (
    <p className="flex items-center gap-2">
      <Warning size={16} weight="regular" aria-hidden className="text-warning" />
      <span className="font-note text-lg leading-5 text-warning" aria-hidden>Old posting</span>
      <span className="sr-only">Old posting.</span>
      <span className="caption-3 text-warning">{days} days</span>
    </p>
  );
}

/** A job as a paper notice (same look as the landing notice card). The whole title is the link to the detail page. */
export function JobCard({ job, reason, now, selected }: { job: JobDoc; reason?: string; now: Date; selected?: boolean }) {
  const posted = postedInfo(job, now);
  const pay = formatPay(job);
  return (
    <article className={cn("min-w-0 rounded-sm border bg-surface-raised transition-shadow duration-300 ease-out-kit lift-on-hover", selected ? "border-action ring-1 ring-action" : "border-border")}>
      <div className="p-4">
        {isDirect(job) ? <span className="caption-3 inline-block rounded-sm bg-highlight px-1 text-on-highlight">Direct to company</span> : null}
        <h3 className={cn("heading-6 text-text", isDirect(job) ? "mt-2" : "")}>
          <Link href={`/job/${job.id}`} className="focus-visible:focus-ring hover:underline">{job.title}</Link>
        </h3>
        <p className="body-6 mt-1 text-text-subtle">{[job.employerName, placeOf(job), pay].filter(Boolean).join(" · ")}</p>
        {reason ? <p className="body-6 mt-2 text-text">{reason}</p> : null}
        <p className="body-6 mt-3 flex flex-wrap gap-x-3 gap-y-1 text-text-subtle">
          <span className="body-4 text-text">{posted.label}</span>
          <span>{repostText(job.repostCount90d)}</span>
          <span className="self-center font-mono text-xs">{job.sourceHost}</span>
        </p>
        {posted.old && posted.age !== null ? <div className="mt-3"><OldPostingNote days={posted.age} /></div> : null}
      </div>
    </article>
  );
}
