import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge, Notice } from "@/components/ui/states";
import { planById } from "@/config/product";
import { lookupUserByEmail } from "@/lib/admin";
import { usd, when } from "@/lib/admin-format";
import { effectivePlan } from "@/lib/billing/entitlement";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "User lookup" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function UsersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const email = one(sp.email).trim();
  const done = one(sp.done);
  const user = email ? await lookupUserByEmail(email) : null;
  const db = await getDb();
  const orgId = user?.orgId ?? null;
  const [ent, acct, suspended] = orgId ? await Promise.all([db.getEntitlement(orgId), db.getBillingAccount(orgId), db.isSuspended(orgId)]) : [null, null, false];
  const refund = acct?.stripeCustomerId ? await db.getRefund(acct.stripeCustomerId) : null;
  const plan = effectivePlan(ent);
  return (
    <>
      <PageHeader title="User lookup" description="Find an account by email. See the plan and refund state, suspend, or refund." />
      <form method="get" className="mb-6 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="email" className="sr-only">Email address</label>
        <input id="email" name="email" type="email" required defaultValue={email} placeholder="name@example.com" className="min-h-11 flex-1 rounded-md border border-border-strong bg-surface px-3 text-text focus-visible:focus-ring" />
        <Button type="submit">Look up</Button>
      </form>
      {done ? <div className="mb-6"><Notice tone="success" title="Done">Action recorded: {done}.</Notice></div> : null}
      {email && !user ? <Notice title="No account with that email" /> : null}
      {user ? (
        <section aria-label="Account" className="flex flex-col gap-4 border border-border bg-surface p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="title-2 text-text">{user.email}</h2>
            {suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">In good standing</Badge>}
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="caption-3 text-text-subtle">Plan now</dt><dd className="body-5 text-text">{plan.name}{ent?.status && ent.status !== "none" ? ` (${ent.status})` : ""}</dd></div>
            <div><dt className="caption-3 text-text-subtle">Renews or ends</dt><dd className="body-5 text-text">{ent?.isPaid && ent.expiresAt ? when(ent.expiresAt) : "Not applicable"}{ent?.cancelAtPeriodEnd ? " (cancelling)" : ""}</dd></div>
            <div><dt className="caption-3 text-text-subtle">Plan on record</dt><dd className="body-5 text-text">{ent ? (planById(ent.plan)?.name ?? ent.plan) : "Free"}</dd></div>
            <div><dt className="caption-3 text-text-subtle">Refund</dt><dd className="body-5 text-text">{refund ? `${usd(refund.amount)} on ${when(refund.at)} (${refund.by})` : "None used"}</dd></div>
          </dl>
          {orgId ? (
            <form method="post" action="/api/admin/users" className="flex flex-wrap gap-2">
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="email" value={user.email} />
              <Button type="submit" name="action" value={suspended ? "unsuspend" : "suspend"} variant="secondary">{suspended ? "Lift suspension" : "Suspend account"}</Button>
              <Button type="submit" name="action" value="refund" variant="danger" disabled={!ent?.isPaid || !!refund}>Refund first payment</Button>
            </form>
          ) : <p className="body-6 text-text-subtle">This user has not finished setup, so there is no billing profile.</p>}
        </section>
      ) : null}
    </>
  );
}
