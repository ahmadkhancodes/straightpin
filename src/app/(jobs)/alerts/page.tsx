import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { getOrgContext } from "@/lib/auth/session";
import { effectivePlan } from "@/lib/billing/entitlement";
import { getDb } from "@/lib/db";
import { QUIZ_STEPS, answersFromProfile, type QuizAnswers } from "@/lib/jobs/matching";

export const metadata: Metadata = { title: "Email alerts", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/sign-in?next=%2Falerts");
  const db = await getDb();
  const profile = await db.getProfile(ctx.org.id);
  const paid = effectivePlan(await db.getEntitlement(ctx.org.id)).id !== "free";
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
        <label className="caption-1 flex flex-col gap-1 text-text-subtle">Instant alerts {paid ? "" : "(paid plans)"}
          <select name="alerts" defaultValue={profile.alerts ? "on" : "off"} disabled={!paid} className={field}><option value="on">On</option><option value="off">Off</option></select>
        </label>
        <div><button type="submit" className={buttonClass("primary")}>Save settings</button></div>
      </form>
      {!paid ? <p className="body-6 mt-6 text-text-subtle"><Link href="/pricing" className="text-action underline underline-offset-4">See plans</Link> for instant alerts.</p> : null}
    </Container>
  );
}
