import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookmarkSimple } from "@phosphor-icons/react/dist/ssr";
import { isDirect, OldPostingNote } from "@/components/jobs/job-card";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { Notice } from "@/components/ui/states";
import { getOrgContext } from "@/lib/auth/session";
import { ageDays, ghostSignals } from "@/lib/crawl/score/ghost";
import { getDb } from "@/lib/db";
import { checkedAgo, formatPay, placeOf, postedInfo, repostText } from "@/lib/jobs/format";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await (await getDb()).getJob((await params).id);
  return { title: job ? `${job.title} at ${job.employerName}` : "Job not found", robots: { index: false } };
}

const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function JobPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const job = await db.getJob(id);
  if (!job) notFound();
  const now = new Date();
  const ctx = await getOrgContext();
  const saved = ctx ? (await db.listSaved(ctx.org.id)).some((s) => s.jobId === job.id) : false;
  const posted = postedInfo(job, now);
  const pay = formatPay(job);
  const signals = ghostSignals({ ageDays: ageDays(job.firstPublishedAt, now), repostCount90d: job.repostCount90d, validThrough: job.validThrough, now });
  const closed = !!job.closedAt;
  return (
    <Container className="max-w-3xl py-10 md:py-16">
      <p><Link href="/matches" className="body-6 text-text-subtle underline underline-offset-4 focus-visible:focus-ring">Back to matches</Link></p>
      {sp.limit === "opens" ? (
        <div className="mt-6"><Notice tone="warning" title="You have used today's free job opens">Free plans open 5 jobs a day. It resets at midnight UTC. <Link href="/pricing" className="text-action underline underline-offset-4">See plans</Link></Notice></div>
      ) : null}
      {sp.limit === "saves" ? (
        <div className="mt-6"><Notice tone="warning" title="Your saved list is full">Free plans keep 10 saved jobs. Remove one in <Link href="/saved" className="text-action underline underline-offset-4">Saved</Link> or <Link href="/pricing" className="text-action underline underline-offset-4">see plans</Link>.</Notice></div>
      ) : null}

      <article className="mt-6 rounded-sm border border-border bg-surface-raised">
        <div className="p-6">
          {isDirect(job) ? <span className="caption-3 inline-block rounded-sm bg-highlight px-1 text-on-highlight">Direct to company</span> : null}
          <h1 className="heading-3 mt-2 text-text">{job.title}</h1>
          <p className="body-4 mt-2 text-text-subtle">{[job.employerName, placeOf(job), pay].filter(Boolean).join(" · ")}</p>
          {posted.old && posted.age !== null ? <div className="mt-4"><OldPostingNote days={posted.age} /></div> : null}
          {signals.filter((s) => s.code !== "old_posting").map((s) => <p key={s.code} className="body-6 mt-2 text-warning">{s.label}</p>)}
        </div>
        <dl className="grid grid-cols-1 gap-4 border-t border-border p-6 sm:grid-cols-2">
          <div><dt className="caption-1 text-text-subtle">First posted by the company</dt><dd className="body-4 text-text">{job.firstPublishedAt ? `${date(job.firstPublishedAt)} (${posted.label.replace("Posted ", "")})` : "Not shown by the company"}</dd></div>
          <div><dt className="caption-1 text-text-subtle">Reposts in the last 90 days</dt><dd className="body-4 text-text">{repostText(job.repostCount90d)}</dd></div>
          <div><dt className="caption-1 text-text-subtle">Last checked</dt><dd className="body-4 text-text">{checkedAgo(job.lastSeenAt, now)}</dd></div>
          <div><dt className="caption-1 text-text-subtle">Source</dt><dd className="font-mono text-sm text-text">{job.sourceHost}</dd></div>
        </dl>
        {job.excerpt ? (
          <div className="border-t border-border p-6">
            <h2 className="title-4 text-text-subtle">From the posting</h2>
            <p className="body-4 mt-2 text-text">{job.excerpt}{job.excerpt.length >= 590 ? "…" : ""}</p>
            <p className="caption-2 mt-2 text-text-subtle">Short excerpt. The full posting is on the company&apos;s own page.</p>
          </div>
        ) : null}
        {closed ? (
          <p className="border-t-[1.5px] border-dashed border-border bg-brand-tint px-6 py-4 body-6 text-text">The company has taken this job down.</p>
        ) : (
          <form method="post" action={`/api/jobs/${job.id}/open`} target="_blank" className="border-t-[1.5px] border-dashed border-border">
            <button type="submit" className="group flex min-h-12 w-full items-center justify-between gap-3 bg-brand-tint px-6 py-3 text-left text-action focus-visible:focus-ring">
              <span className="button-md inline-flex items-center gap-2 whitespace-nowrap transition-transform duration-tear ease-out-kit motion-reduce:transition-none group-hover:translate-x-1"><ArrowRight size={20} weight="regular" aria-hidden />Apply at company</span>
              <span className="hidden min-w-0 truncate font-mono text-xs text-text-subtle sm:block">{job.sourceHost}</span>
            </button>
          </form>
        )}
      </article>

      <form method="post" action="/api/saved" className="mt-6 flex flex-wrap items-center gap-3">
        <input type="hidden" name="jobId" value={job.id} />
        <input type="hidden" name="action" value={saved ? "unsave" : "save"} />
        <button type="submit" className={buttonClass("secondary", "md")}><BookmarkSimple size={20} weight={saved ? "fill" : "regular"} aria-hidden />{saved ? "Remove from saved" : "Save this job"}</button>
        {!ctx ? <span className="body-6 text-text-subtle">You will be asked to sign in.</span> : null}
      </form>
    </Container>
  );
}
