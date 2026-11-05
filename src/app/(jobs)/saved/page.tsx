import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JobCard } from "@/components/jobs/job-card";
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
    <Container className="py-10 md:py-16">
      <h1 className="heading-3 text-text">Saved jobs</h1>
      <p className="body-4 mt-2 text-text-subtle">{usage ? `${usage.used} of ${usage.limit >= 1_000_000 ? "unlimited" : usage.limit} saved.` : null}</p>
      {saved.length === 0 ? (
        <div className="mt-8"><EmptyState title="Nothing saved yet" body="Save a job from its page and it will wait here." action={<Link href="/matches" className={buttonClass("secondary")}>See my matches</Link>} /></div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {saved.map((s) => {
            const job = byId.get(s.jobId);
            return (
              <li key={s.jobId} className="flex min-w-0 flex-col gap-2">
                {job ? <JobCard job={job} now={now} /> : <p className="rounded-sm border border-border bg-surface-raised p-4 body-6 text-text-subtle">This job is no longer in our list.</p>}
                <form method="post" action="/api/saved">
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
