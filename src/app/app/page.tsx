import Link from "next/link";
import { Meter } from "@/components/app/meter";
import { METERS_SHOWN } from "@/components/app/labels";
import { PageHeader, Panel } from "@/components/app/page-header";
import { buttonClass } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/states";
import { requireOrg } from "@/lib/auth/session";
import { effectivePlan } from "@/lib/billing/entitlement";
import { currentUsage } from "@/lib/billing/usage";
import { getDb } from "@/lib/db";
import { fieldLabel } from "@/lib/jobs/fields";
import { firstRunSteps } from "@/lib/jobs/checklist";
import { answersFromProfile, liveCount, queryFromAnswers } from "@/lib/jobs/matching";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const ctx = await requireOrg({ page: true });
  const db = await getDb();
  const ent = await db.getEntitlement(ctx.org.id);
  const plan = effectivePlan(ent);
  const usage = await currentUsage(db, ctx.org.id, METERS_SHOWN);
  const profile = await db.getProfile(ctx.org.id);
  const saved = await db.listSaved(ctx.org.id);
  const alertRules = await db.listAlertRules(ctx.org.id);
  const steps = firstRunSteps({ hasProfile: !!profile, saved: saved.length, digestOn: !!profile?.digest, alertRules: alertRules.length, opensToday: usage.find((u) => u.meter === "opens")?.used ?? 0 });
  const count = profile ? (await liveCount(db, queryFromAnswers(answersFromProfile(profile)))).count : 0;
  return (
    <>
      <PageHeader title={ctx.org.name} description={`Signed in as ${ctx.user.email}.`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="plan-h" className="flex flex-col gap-4 border border-border border-t-rule bg-surface-raised p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 id="plan-h" className="kicker text-text-subtle">Current plan</h2>
            {ent?.status === "past_due" ? <Badge tone="warning">Payment failed</Badge> : ent?.cancelAtPeriodEnd ? <Badge tone="warning">Ends soon</Badge> : <Badge tone="success">Active</Badge>}
          </div>
          <p className="heading-4 text-text">{plan.name}</p>
          <p className="body-6 text-text-subtle">{plan.tagline}</p>
          <Link href="/app/billing" className={buttonClass("secondary", "md", "self-start")}>
            {plan.id === "free" ? "See plans" : "Manage plan"}
          </Link>
        </section>
        <section aria-labelledby="usage-h" className="flex flex-col gap-4 border border-border border-t-rule bg-surface-raised p-6 lg:col-span-2">
          <h2 id="usage-h" className="kicker text-text-subtle">Usage</h2>
          <div className="flex flex-col gap-6">
            {usage.map((u) => <Meter key={u.meter} state={u} />)}
          </div>
        </section>
      </div>
      {steps.some((x) => !x.done) ? (
        <Panel title="Get started" description={`${steps.filter((x) => x.done).length} of ${steps.length} done. It takes about two minutes.`}>
          <ol className="flex flex-col divide-y divide-border border-y border-border">
            {steps.map((x) => (
              <li key={x.id} className="flex min-h-11 items-center gap-3 py-2">
                <span aria-hidden className={x.done ? "text-success" : "text-text-subtle"}>{x.done ? "✓" : "○"}</span>
                {x.done ? <span className="body-6 text-text-subtle line-through">{x.label}<span className="sr-only"> (done)</span></span> : <Link href={x.href} className="body-6 text-action underline underline-offset-4">{x.label}</Link>}
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
      <Panel title="Your matches" description="Direct jobs for the field you pick.">
        {profile ? (
          <EmptyState
            title={`${count.toLocaleString("en-US")} direct ${count === 1 ? "match" : "matches"} for ${fieldLabel(profile.field)}`}
            body={`${saved.length} saved. Daily email ${profile.digest ? "on" : "off"}.`}
            action={<Link href="/matches" className={buttonClass("primary")}>See my matches</Link>}
          />
        ) : (
          <EmptyState
            title="Answer six questions to see your matches"
            body="One question per screen, with a live count from the job database."
            action={<Link href="/quiz" className={buttonClass("primary")}>Start the quiz</Link>}
          />
        )}
      </Panel>
    </>
  );
}
