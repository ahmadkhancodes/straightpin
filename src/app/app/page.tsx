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

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const ctx = await requireOrg({ page: true });
  const db = await getDb();
  const ent = await db.getEntitlement(ctx.org.id);
  const plan = effectivePlan(ent);
  const usage = await currentUsage(db, ctx.org.id, METERS_SHOWN);
  return (
    <>
      <PageHeader title={ctx.org.name} description={`Signed in as ${ctx.user.email}.`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="plan-h" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 id="plan-h" className="title-4 text-text-subtle">Current plan</h2>
            {ent?.status === "past_due" ? <Badge tone="warning">Payment failed</Badge> : ent?.cancelAtPeriodEnd ? <Badge tone="warning">Ends soon</Badge> : <Badge tone="success">Active</Badge>}
          </div>
          <p className="heading-4 text-text">{plan.name}</p>
          <p className="body-6 text-text-subtle">{plan.tagline}</p>
          <Link href="/app/billing" className={buttonClass("secondary", "md", "self-start")}>
            {plan.id === "free" ? "See plans" : "Manage plan"}
          </Link>
        </section>
        <section aria-labelledby="usage-h" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 lg:col-span-2">
          <h2 id="usage-h" className="title-4 text-text-subtle">Usage</h2>
          <div className="flex flex-col gap-6">
            {usage.map((u) => <Meter key={u.meter} state={u} />)}
          </div>
        </section>
      </div>
      <Panel title="Workspace" description="Where your product's main screen lives.">
        <EmptyState
          title="Your product's main screen goes here"
          body={
            <>
              This page is the signed-in home. Replace <code>src/app/app/page.tsx</code> with the screen people use every day, and keep the plan and usage cards above it or move them to the sidebar. Start with the one task a new member must finish to get value, and teach it here before they see anything else.
            </>
          }
          action={<Link href="/app/settings/members" className={buttonClass("primary")}>Invite a teammate</Link>}
        />
      </Panel>
    </>
  );
}
