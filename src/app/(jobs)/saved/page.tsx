import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JobCard } from "@/components/jobs/job-card";
import { NoticeCard } from "@/components/marketing/notice-card";
import { sampleJobs } from "@/content/sample-jobs";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { getOrgContext } from "@/lib/auth/session";
import { currentUsage } from "@/lib/billing/usage";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "Saved jobs", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/sign-in?next=%2Fsaved");
  const db = await getDb();
  const saved = await db.listSaved(ctx.org.id);
  const jobs = await db.getJobs(saved.map((s) => s.jobId));
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const [usage] = await currentUsage(db, ctx.org.id, ["saves"]);
  const now = new Date();
  return (
    <Container className="py-8 md:py-12">
      <header className="border-b-2 border-rule pb-6">
      <p className="kicker text-text-subtle">Your list</p>
      <h1 className="heading-3 md:heading-2 mt-3 text-text">Saved jobs</h1>
      <p className="body-6 figures mt-3 text-text-subtle">{usage ? `${usage.used} of ${usage.limit >= 1_000_000 ? "unlimited" : usage.limit} saved.` : null}</p>
      {saved.length > 0 ? <p className="mt-3"><a href="/api/saved/export" download className={buttonClass("tertiary", "sm")}>Download as spreadsheet (CSV)</a></p> : null}
      </header>
      {saved.length === 0 ? (
        <div className="mt-8"><EmptyState title="Nothing saved yet" body="Open a job from your matches and press Save. It waits here with its posted date, so you can come back and apply at the company." action={<Link href="/matches" className={buttonClass("primary")}>See my matches</Link>} visual={<div className="w-full max-w-xl" aria-label="Example of a saved job"><p className="kicker mb-2 text-text-subtle">Example</p><div className="border-y border-rule"><NoticeCard job={sampleJobs[0]!} showTear={false} framed={false} /></div></div>} /></div>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y border-rule bg-surface-raised">
          {saved.map((s) => {
            const job = byId.get(s.jobId);
            return (
              <li key={s.jobId} className="flex min-w-0 flex-col gap-0 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">{job ? <JobCard job={job} now={now} /> : <p className="p-4 body-6 text-text-subtle md:px-6">This job is no longer in our list.</p>}</div>
                <form method="post" action="/api/saved" className="px-4 pb-4 sm:pb-0 sm:pr-6">
                  <input type="hidden" name="jobId" value={s.jobId} />
                  <input type="hidden" name="action" value="unsave" />
                  <input type="hidden" name="next" value="/saved" />
                  <button type="submit" className={buttonClass("tertiary", "sm")}>Remove</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
