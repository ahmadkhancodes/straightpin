import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { getOrgContext } from "@/lib/auth/session";
import { effectivePlan } from "@/lib/billing/entitlement";
import { FIELDS, fieldLabel } from "@/lib/jobs/fields";
import { ruleLabel } from "@/lib/jobs/alertRules";
import { getDb } from "@/lib/db";
import { QUIZ_STEPS, answersFromProfile, type QuizAnswers } from "@/lib/jobs/matching";

export const metadata: Metadata = { title: "Email alerts", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function AlertsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const ctx = await getOrgContext();
  if (!ctx) redirect("/sign-in?next=%2Falerts");
  const db = await getDb();
  const profile = await db.getProfile(ctx.org.id);
  const plan = effectivePlan(await db.getEntitlement(ctx.org.id));
  const paid = plan.id !== "free";
  const rules = await db.listAlertRules(ctx.org.id);
  if (!profile) {
    return <Container className="max-w-2xl py-10 md:py-16"><EmptyState title="Answer the quiz first" body="We need your answers to know which jobs to email you about." action={<Link href="/quiz" className={buttonClass("primary")}>Start the quiz</Link>} /></Container>;
  }
  const a = answersFromProfile(profile);
  const field = "min-h-11 rounded-sm border border-border bg-surface-raised px-3 text-text focus-visible:focus-ring";
  return (
    <Container className="max-w-2xl py-10 md:py-16">
      <h1 className="heading-3 text-text">Email alerts</h1>
      <p className="body-4 mt-2 text-text-subtle">
        {paid ? "Your plan sends new matches within the hour." : "Free plans get one email a day at 8:00 in your time zone. Paid plans get alerts within the hour."} Every email has a one click unsubscribe.
      </p>
      <form method="post" action="/api/profile" className="mt-8 flex flex-col gap-4">
        {QUIZ_STEPS.map((s) => <input key={s.key} type="hidden" name={s.key} value={String(a[s.key as keyof QuizAnswers])} />)}
        <label className="caption-1 flex flex-col gap-1 text-text-subtle">Daily digest
          <select name="digest" defaultValue={profile.digest ? "on" : "off"} className={field}><option value="on">On</option><option value="off">Off</option></select>
        </label>
        <div><button type="submit" className={buttonClass("primary")}>Save settings</button></div>
      </form>
      <section aria-labelledby="rules-h" className="mt-12 border-t border-border pt-8">
        <h2 id="rules-h" className="heading-5 text-text">Instant alerts</h2>
        <p className="body-5 mt-2 text-text-subtle">
          {paid ? `Your ${plan.name} plan keeps ${plan.alertLimit} saved alerts (${rules.length} used). Each one emails new matches within the hour, at most once an hour.` : "Instant alerts are on paid plans. Each one is a saved search, a field, a place and a pay floor, emailed within the hour."}
        </p>
        {sp.error === "limit" ? <p role="alert" className="body-6 mt-3 text-warning">You have used every alert on your plan. Delete one to add another.</p> : null}
        {sp.error === "invalid" ? <p role="alert" className="body-6 mt-3 text-warning">Check the field, country and pay floor and try again.</p> : null}
        {sp.added ? <p role="status" className="body-6 mt-3 text-text">Alert saved.</p> : null}
        <ul className="mt-4 flex flex-col gap-3">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-sm border border-border bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="title-4 text-text">{ruleLabel(r, fieldLabel(r.field))}</p><p className="caption-2 text-text-subtle">{r.active ? "On" : "Paused"}</p></div>
              <div className="flex gap-2">
                <form method="post" action="/api/alerts"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="action" value={r.active ? "pause" : "resume"} /><button type="submit" className={field}>{r.active ? "Pause" : "Turn on"}</button></form>
                <form method="post" action="/api/alerts"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="action" value="delete" /><button type="submit" className={field}>Delete</button></form>
              </div>
            </li>
          ))}
        </ul>
        {paid && rules.length < plan.alertLimit ? (
          <form method="post" action="/api/alerts" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input type="hidden" name="action" value="add" />
            <label className="caption-1 flex flex-col gap-1 text-text-subtle">Field
              <select name="field" defaultValue={profile.field} className={field}>{FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
            </label>
            <label className="caption-1 flex flex-col gap-1 text-text-subtle">Country
              <select name="country" defaultValue={profile.country} className={field}><option value="US">United States</option><option value="CA">Canada</option><option value="UK">United Kingdom</option></select>
            </label>
            <label className="caption-1 flex flex-col gap-1 text-text-subtle">City or region (optional)
              <input name="location" maxLength={60} placeholder="Toronto" className={field} />
            </label>
            <label className="caption-1 flex flex-col gap-1 text-text-subtle">Pay floor per hour (optional)
              <input name="payFloor" type="number" min={0} max={500} step="0.5" inputMode="decimal" placeholder="18" className={field} />
            </label>
            <div className="sm:col-span-2"><button type="submit" className={buttonClass("primary")}>Save alert</button></div>
          </form>
        ) : null}
      </section>
      {!paid ? <p className="body-6 mt-6 text-text-subtle"><Link href="/pricing" className="text-action underline underline-offset-4">See plans</Link> for instant alerts.</p> : null}
    </Container>
  );
}
