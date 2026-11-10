import type { Metadata } from "next";
import { cadence } from "@/config/product";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { JobCard } from "@/components/jobs/job-card";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { getOrgContext } from "@/lib/auth/session";
import { currentUsage } from "@/lib/billing/usage";
import { agencyReceipt } from "@/lib/classify/classify";
import { getDb } from "@/lib/db";
import { fieldLabel } from "@/lib/jobs/fields";
import { answersFromProfile, liveCount, parseAnswers, QUIZ_STEPS, queryFromAnswers, rankJobs, type QuizAnswers } from "@/lib/jobs/matching";

export const metadata: Metadata = { title: "Your matches", robots: { index: false } };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PAGE_SIZE = 20;
const POOL = 100;

const selectClass = "min-h-11 w-full rounded-sm border border-border bg-surface-raised px-3 text-text focus-visible:focus-ring";

export default async function MatchesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const get = (k: string) => first(sp[k]);
  const ctx = await getOrgContext();
  const db = await getDb();
  const profile = ctx ? await db.getProfile(ctx.org.id) : null;
  const fromUrl = parseAnswers(get);
  const answers: QuizAnswers | undefined = fromUrl ?? (profile ? answersFromProfile(profile) : undefined);
  if (!answers) redirect("/quiz");

  const now = new Date();
  const q = queryFromAnswers(answers);
  const [{ count, agencyHidden }, pool, usage] = await Promise.all([
    liveCount(db, q),
    db.queryJobs({ ...q, limit: POOL }),
    ctx ? currentUsage(db, ctx.org.id, ["opens"]) : Promise.resolve([]),
  ]);
  const ranked = rankJobs(pool, answers, now);
  const page = Math.max(1, Number(get("page")) || 1);
  const shown = ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const params = new URLSearchParams(QUIZ_STEPS.map((s) => [s.key, String(answers[s.key as keyof QuizAnswers])]));
  const pageHref = (n: number) => `/matches?${new URLSearchParams([...params, ["page", String(n)]]).toString()}`;
  const changed = !profile || JSON.stringify(answersFromProfile(profile)) !== JSON.stringify(answers);
  const opens = usage[0];

  return (
    <Container className="py-10 md:py-16">
      <h1 className="heading-3 text-text">Your matches</h1>
      <p className="body-4 mt-2 text-text-subtle" data-testid="match-count">
        <b className="tabular-nums text-text">{count.toLocaleString("en-US")}</b> direct {count === 1 ? "match" : "matches"} for {fieldLabel(answers.field)} in {answers.country === "UK" ? "the UK" : answers.country === "CA" ? "Canada" : "the US"}.
        {opens ? ` ${Math.max(0, opens.limit - opens.used)} of ${opens.limit} job opens left today.` : " Free: 5 job opens a day."}
      </p>

      <form method="get" action="/matches" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6" aria-label="Filters">
        {([
          ["field", "Field", QUIZ_STEPS[0].options],
          ["country", "Country", QUIZ_STEPS[1].options],
          ["remote", "Workplace", QUIZ_STEPS[2].options],
          ["payFloor", "Pay", QUIZ_STEPS[3].options],
          ["level", "Level", QUIZ_STEPS[4].options],
          ["schedule", "Schedule", QUIZ_STEPS[5].options],
        ] as const).map(([key, label, options]) => (
          <label key={key} className="caption-1 flex flex-col gap-1 text-text-subtle">
            {label}
            <select name={key} defaultValue={String(answers[key])} className={selectClass}>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        ))}
        <div className="col-span-2 md:col-span-6"><button type="submit" className={buttonClass("secondary", "md")}>Update list</button></div>
      </form>

      {changed ? (
        <div className="mt-6 rounded-sm border border-dashed border-border bg-surface-raised p-4">
          {ctx ? (
            <form method="post" action="/api/profile" className="flex flex-wrap items-center gap-3">
              {QUIZ_STEPS.map((s) => <input key={s.key} type="hidden" name={s.key} value={String(answers[s.key as keyof QuizAnswers])} />)}
              <p className="body-6 min-w-0 flex-1 text-text">Save these answers to get a daily email of new matches.</p>
              <button type="submit" className={buttonClass("primary", "md")}>Save and email me</button>
            </form>
          ) : (
            <p className="body-6 text-text">
              <Link href={`/sign-in?next=${encodeURIComponent(`/matches?${params}`)}`} className="text-action underline underline-offset-4 focus-visible:focus-ring">Create a free account</Link> to save your matches and get a daily email of new jobs.
            </p>
          )}
        </div>
      ) : sp.saved ? <p className="mt-6 body-6 text-text" role="status">Saved. Your daily email is on. <Link href="/alerts" className="text-action underline underline-offset-4">Change email settings</Link></p> : null}

      {agencyHidden > 0 ? (
        <p className="mt-6 flex items-start gap-2 rounded-sm border border-dashed border-border bg-surface-raised p-3 body-6 text-text">
          <ShieldCheck size={20} weight="regular" aria-hidden className="mt-0.5 shrink-0 text-action" />
          <b className="font-semibold">{agencyReceipt(agencyHidden)}</b>
        </p>
      ) : null}

      {shown.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No matches yet"
            body={`Nothing in the job database fits these answers right now. We check company pages ${cadence.checkPhrase}, so try a wider answer or check back soon.`}
            action={<Link href="/quiz" className={buttonClass("secondary")}>Change my answers</Link>}
          />
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map((r) => <li key={r.job.id} className="min-w-0"><JobCard job={r.job} reason={r.reason} now={now} /></li>)}
        </ul>
      )}

      {ranked.length > PAGE_SIZE ? (
        <nav aria-label="Pages" className="mt-8 flex items-center gap-4">
          {page > 1 ? <Link href={pageHref(page - 1)} className={buttonClass("secondary")}>Previous</Link> : null}
          <span className="body-6 text-text-subtle">Page {page} of {Math.ceil(ranked.length / PAGE_SIZE)}</span>
          {page * PAGE_SIZE < ranked.length ? <Link href={pageHref(page + 1)} className={buttonClass("secondary")}>Next</Link> : null}
        </nav>
      ) : null}
    </Container>
  );
}
