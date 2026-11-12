import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { formatPay, placeOf, postedInfo, repostText } from "@/lib/jobs/format";
import type { JobDoc } from "@/lib/jobs/types";
import { DirectStamp, MetaLine, OldPostingNote } from "./listing-parts";

export { OldPostingNote };

/** Direct to company: the job came from the employer's own board or page and was not flagged as an agency post. */
export const isDirect = (j: Pick<JobDoc, "agencyFlag">) => j.agencyFlag === "no";

/**
 * A job as one row of a classifieds column: title and employer on the left, pay in tabular figures on the
 * right, a mono meta line under it. Rows sit on one sheet separated by hairlines (the parent list draws them).
 */
export function JobCard({ job, reason, now, selected }: { job: JobDoc; reason?: string; now: Date; selected?: boolean }) {
  const posted = postedInfo(job, now);
  const pay = formatPay(job);
  return (
    <article className={cn("group relative min-w-0 px-4 py-4 transition-colors duration-300 ease-out-kit hover:bg-surface md:px-6", selected && "bg-brand-tint")}>
      <div className="flex flex-col gap-x-6 gap-y-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {isDirect(job) ? <DirectStamp /> : null}
          <h3 className={cn("title-1 font-semibold text-text", isDirect(job) ? "mt-2" : "")}>
            <Link href={`/job/${job.id}`} className="underline-offset-4 after:absolute after:inset-0 hover:underline focus-visible:focus-ring">{job.title}</Link>
          </h3>
          <p className="body-6 mt-0.5 text-text-subtle">{[job.employerName, placeOf(job)].filter(Boolean).join(" · ")}</p>
        </div>
        {pay ? <p className="body-5 figures shrink-0 text-text sm:text-right">{pay}</p> : null}
      </div>
      {reason ? <p className="body-6 mt-2 text-text">{reason}</p> : null}
      <MetaLine posted={posted.label} reposts={repostText(job.repostCount90d)} host={job.sourceHost} />
      {posted.old && posted.age !== null ? <div className="mt-2"><OldPostingNote days={posted.age} /></div> : null}
    </article>
  );
}
