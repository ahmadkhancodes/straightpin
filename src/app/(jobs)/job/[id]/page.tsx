import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookmarkSimple } from "@phosphor-icons/react/dist/ssr";
import { isDirect, OldPostingNote } from "@/components/jobs/job-card";
import { DirectStamp } from "@/components/jobs/listing-parts";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { ApplyButton } from "./apply-button";
import { product } from "@/config/product";
import { Notice } from "@/components/ui/states";
import { getOrgContext } from "@/lib/auth/session";
import { ageDays, ghostSignals } from "@/lib/crawl/score/ghost";
import { getDb } from "@/lib/db";
import { jobPostingLd, ldScript } from "@/lib/jobs/jobPostingLd";
import { pageMetadata } from "@/lib/seo";
import { checkedAgo, formatPay, placeOf, postedInfo, repostText, resetPhrase } from "@/lib/jobs/format";

const FREE = product.plans[0]!.limits;
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await (await getDb()).getJob((await params).id);
  if (!job) return { title: "Job not found", robots: { index: false } };
  // Open jobs are indexable with a canonical address; a job the company took down is not.
  return pageMetadata({
    title: `${job.title} at ${job.employerName}`,
    description: `${job.title} at ${job.employerName}${job.location ? `, ${job.location}` : ""}. First posted date, repost count and a direct link to the company's own page.`,
    path: `/job/${job.id}`,
    noindex: !!job.closedAt,
  });
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
  const ld = jobPostingLd(job);
  return (
    <Container className="max-w-4xl py-8 md:py-12">
      {ld ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(ld) }} /> : null}
      <p><Link href="/matches" className="body-6 text-text-subtle underline underline-offset-4 focus-visible:focus-ring">Back to matches</Link></p>
      {sp.limit === "opens" ? (
        <div className="mt-6"><Notice tone="warning" title="You have used today's free job opens">Free plans open {FREE.opens} jobs a day. You get them back {resetPhrase()}. Jobs you already opened stay open, and you can still save jobs. <Link href="/pricing" className="text-action underline underline-offset-4">See plans</Link></Notice></div>
      ) : null}
      {sp.limit === "saves" ? (
        <div className="mt-6"><Notice tone="warning" title="Your saved list is full">Free plans keep {FREE.saves} saved jobs. Remove one in <Link href="/saved" className="text-action underline underline-offset-4">Saved</Link> or <Link href="/pricing" className="text-action underline underline-offset-4">see plans</Link>.</Notice></div>
      ) : null}

      <article className="mt-6 border border-border border-t-2 border-t-rule bg-surface-raised">
        <div className="p-6 md:p-8">
          {isDirect(job) ? <DirectStamp /> : null}
          <h1 className="heading-3 md:heading-2 mt-3 text-text">{job.title}</h1>
          <p className="title-2 mt-3 text-text">{job.employerName}<span className="text-text-subtle"> · {placeOf(job)}</span></p>
          {pay ? <p className="heading-5 figures mt-2 text-text">{pay}</p> : null}
          {posted.old && posted.age !== null ? <div className="mt-4"><OldPostingNote days={posted.age} /></div> : null}
          {signals.filter((s) => s.code !== "old_posting").map((s) => <p key={s.code} className="body-6 mt-2 text-warning">{s.label}</p>)}
        </div>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-border p-6 sm:grid-cols-2 md:px-8">
          <div><dt className="kicker text-text-subtle">First posted by the company</dt><dd className="body-4 text-text">{job.firstPublishedAt ? `${date(job.firstPublishedAt)} (${posted.label.replace("Posted ", "")})` : "Not shown by the company"}</dd></div>
          <div><dt className="kicker text-text-subtle">Reposts in the last 90 days</dt><dd className="body-4 text-text">{repostText(job.repostCount90d)}</dd></div>
          <div><dt className="kicker text-text-subtle">Last checked</dt><dd className="body-4 text-text">{checkedAgo(job.lastSeenAt, now)}</dd></div>
          <div><dt className="kicker text-text-subtle">Source</dt><dd className="font-mono text-sm text-text">{job.sourceHost}</dd></div>
        </dl>
        {job.excerpt ? (
          <div className="border-t border-border p-6 md:px-8">
            <h2 className="kicker text-text-subtle">From the posting</h2>
            <p className="body-4 mt-2 text-text">{job.excerpt}{job.excerpt.length >= 590 ? "…" : ""}</p>
            <p className="caption-2 mt-2 text-text-subtle">Short excerpt. The full posting is on the company&apos;s own page.</p>
          </div>
        ) : null}
        {closed ? (
          <p className="border-t-[1.5px] border-dashed border-border bg-brand-tint px-6 py-4 body-6 text-text">The company has taken this job down.</p>
        ) : (
          <ApplyButton jobId={job.id} host={job.sourceHost} />
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
