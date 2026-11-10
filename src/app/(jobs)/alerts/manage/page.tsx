import type { Metadata } from "next";
import { cadence } from "@/config/product";
import Link from "next/link";
import { Container } from "@/components/ui/layout";
import { Notice } from "@/components/ui/states";
import { getDb } from "@/lib/db";
import { fieldLabel } from "@/lib/jobs/fields";
import { ruleLabel, verifyManageToken } from "@/lib/jobs/alertRules";

export const metadata: Metadata = { title: "Manage your alerts", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const btn = "min-h-11 rounded-sm border border-border bg-surface-raised px-3 text-text focus-visible:focus-ring";

/** No login: the signed link in every alert email is the credential. */
export default async function ManageAlertsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const e = one(sp.e);
  const t = one(sp.t);
  if (!(await verifyManageToken(e, t))) {
    return <Container className="max-w-2xl py-10 md:py-16"><Notice tone="warning" title="This link is not valid">Use the link from your most recent alert email, or <Link href="/sign-in?next=%2Falerts" className="text-action underline underline-offset-4">sign in</Link> to manage alerts there.</Notice></Container>;
  }
  const db = await getDb();
  const rules = await db.listAlertRulesByEmail(e);
  const hidden = (
    <>
      <input type="hidden" name="e" value={e} />
      <input type="hidden" name="t" value={t} />
    </>
  );
  return (
    <Container className="max-w-2xl py-10 md:py-16">
      <h1 className="heading-3 text-text">Your alerts</h1>
      <p className="body-4 mt-2 text-text-subtle">For {e}. Nothing here needs a password. Anyone with this link can change these settings, so do not forward the email.</p>
      {sp.saved ? <div className="mt-6"><Notice tone="success" title="Saved">Your change is in.</Notice></div> : null}
      <ul className="mt-8 flex flex-col gap-3">
        {rules.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 rounded-sm border border-border bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="title-4 text-text">{ruleLabel(r, fieldLabel(r.field))}</p>
              <p className="caption-2 text-text-subtle">{r.active ? `On. New matches are emailed ${cadence.alertPhrase}.` : "Paused."}</p>
            </div>
            <div className="flex gap-2">
              <form method="post" action="/api/alerts/manage">{hidden}<input type="hidden" name="id" value={r.id} /><input type="hidden" name="action" value={r.active ? "pause" : "resume"} /><button type="submit" className={btn}>{r.active ? "Pause" : "Turn on"}</button></form>
              <form method="post" action="/api/alerts/manage">{hidden}<input type="hidden" name="id" value={r.id} /><input type="hidden" name="action" value="delete" /><button type="submit" className={btn}>Delete</button></form>
            </div>
          </li>
        ))}
      </ul>
      {rules.length === 0 ? <p className="body-5 mt-8 text-text-subtle">You have no saved alerts.</p> : null}
      <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
        <form method="post" action="/api/alerts/manage">{hidden}<input type="hidden" name="action" value="stop-alerts" /><button type="submit" className={btn}>Stop all saved alerts</button></form>
        <form method="post" action="/api/alerts/manage">{hidden}<input type="hidden" name="action" value="stop-digest" /><button type="submit" className={btn}>Stop the daily digest</button></form>
      </div>
      <p className="body-6 mt-6 text-text-subtle">Sign-in emails still arrive. To add or change an alert, <Link href="/sign-in?next=%2Falerts" className="text-action underline underline-offset-4">sign in</Link>.</p>
    </Container>
  );
}
