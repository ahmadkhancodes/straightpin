import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/layout";
import { getDb } from "@/lib/db";
import { fieldLabel } from "@/lib/jobs/fields";
import { liveCount, optionLabel, partialAnswers, QUIZ_STEPS, queryFromAnswers } from "@/lib/jobs/matching";

export const metadata: Metadata = { title: "Find your matches in six questions", alternates: { canonical: "/quiz" } };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * One question per screen, server rendered: every option is a submit button of a GET form, so it works without JS.
 * The live count under the question comes from the job database (indexed count, 60 s cache).
 */
export default async function QuizPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const get = (k: string) => first(sp[k]);
  const answered = partialAnswers(get);
  const done = Object.keys(answered).length;
  if (done >= QUIZ_STEPS.length) redirect(`/matches?${new URLSearchParams(QUIZ_STEPS.map((s) => [s.key, String(answered[s.key as keyof typeof answered])])).toString()}`);
  const step = QUIZ_STEPS[done]!;
  const { count, agencyHidden } = await liveCount(await getDb(), queryFromAnswers(answered));
  const prior = QUIZ_STEPS.slice(0, done).map((s) => [s.key, String(answered[s.key as keyof typeof answered])] as const);
  const back = done > 0 ? `/quiz?${new URLSearchParams(prior.slice(0, -1).map(([k, v]) => [k, v])).toString()}` : "/";
  const relax = count === 0 && done > 1 ? back : null;
  return (
    <Container className="max-w-2xl py-10 md:py-16">
      <p className="kicker text-text-subtle">Question <span className="figures">{done + 1}</span> of {QUIZ_STEPS.length}</p>
      <div className="mt-3 h-1 bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={QUIZ_STEPS.length} aria-valuenow={done} aria-label="Quiz progress">
        <div className="h-1 bg-rule" style={{ width: `${(done / QUIZ_STEPS.length) * 100}%` }} />
      </div>
      <h1 className="heading-3 md:heading-2 mt-8 text-text">{step.title}</h1>
      <form method="get" action="/quiz" className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {prior.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {step.options.map((o) => (
          <button
            key={o.value}
            type="submit"
            name={step.key}
            value={o.value}
            className="button-md min-h-12 rounded-md border border-border-strong bg-surface-raised px-4 py-3 text-left text-text transition-colors duration-300 ease-out-kit hover:border-rule hover:bg-brand-tint focus-visible:focus-ring"
          >
            {optionLabel(step.key, o.label, answered.country)}
          </button>
        ))}
      </form>
      <p className="mt-8 border-t-2 border-rule pt-4 body-6 text-text-subtle" aria-live="polite" data-testid="live-count">
        <b className="heading-4 figures text-text">{count.toLocaleString("en-US")}</b>{" "}
        {count === 1 ? "direct match" : "direct matches"} so far{done > 0 ? ` for ${fieldLabel(answered.field!)}` : ""}.
        {agencyHidden > 0 ? ` ${agencyHidden} staffing agency ${agencyHidden === 1 ? "post" : "posts"} removed.` : ""}
      </p>
      {relax ? (
        <p className="mt-3 body-6 text-text">
          Nothing matches yet. <Link href={relax} className="text-action underline underline-offset-4 focus-visible:focus-ring">Change your last answer</Link> to widen the list.
        </p>
      ) : null}
      <p className="mt-8"><Link href={back} className="body-6 text-text-subtle underline underline-offset-4 focus-visible:focus-ring">{done > 0 ? "Back" : "Home"}</Link></p>
    </Container>
  );
}
