import type { Metadata } from "next";
import { cadence, product } from "@/config/product";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { JobCard } from "@/components/jobs/job-card";
import { NoticeCard } from "@/components/marketing/notice-card";
import { sampleJobs } from "@/content/sample-jobs";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/states";
import { getOrgContext } from "@/lib/auth/session";
import { currentUsage } from "@/lib/billing/usage";
import { agencyReceipt } from "@/lib/classify/classify";
import { getDb } from "@/lib/db";
import { fieldLabel } from "@/lib/jobs/fields";
import { ANSWERS_COOKIE, answersFromCookie, answersFromProfile, answersQuery, liveCount, optionLabel, parseAnswers, QUIZ_STEPS, queryFromAnswers, rankJobs, type QuizAnswers } from "@/lib/jobs/matching";

export const metadata: Metadata = { title: "Your matches", robots: { index: false } };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PAGE_SIZE = 20;
const POOL = 100;

const selectClass = "min-h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-text focus-visible:focus-ring";

export default async function MatchesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const get = (k: string) => first(sp[k]);
  const ctx = await getOrgContext();
  const db = await getDb();
  const profile = ctx ? await db.getProfile(ctx.org.id) : null;
  const fromUrl = parseAnswers(get);
  const answers: QuizAnswers | undefined = fromUrl ?? (profile ? answersFromProfile(profile) : undefined);
  if (!answers) {
    // "Back to matches" from a job, or a bare /matches: reuse the last answers instead of starting the quiz again.
    const remembered = answersFromCookie((await cookies()).get(ANSWERS_COOKIE)?.value);
    if (remembered) redirect(`/matches?${answersQuery(remembered)}`);
    redirect("/quiz");
  }

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

  const place = answers.country === "UK" ? "the UK" : answers.country === "CA" ? "Canada" : "the US";
  return (
    <Container className="py-8 md:py-12">
      <header className="border-b-2 border-rule pb-6">
        <p className="kicker text-text-subtle">Your matches · {fieldLabel(answers.field)} · {place}</p>
        <h1 className="heading-3 md:heading-2 mt-3 text-text" data-testid="match-count">
          <span className="figures">{count.toLocaleString("en-US")}</span> direct {count === 1 ? "match" : "matches"}
          <span className="sr-only"> for {fieldLabel(answers.field)} in {place}.</span>
        </h1>
        <p className="body-6 mt-3 text-text-subtle">
          {opens ? `${Math.max(0, opens.limit - opens.used)} of ${opens.limit} job opens left today.` : `Free: ${product.plans[0]!.limits.opens} job opens a day.`} Sorted by fit, newest first when tied.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <aside className="lg:col-span-3">
          {/* Phones: filters fold behind one 44px toggle so the list starts on the first screen. CSS only (peer checkbox). */}
          <input type="checkbox" id="refine-toggle" className="peer sr-only lg:hidden" />
          <label htmlFor="refine-toggle" className="button-md flex min-h-11 items-center justify-between border border-rule bg-surface-raised px-4 peer-focus-visible:focus-ring lg:hidden">
            <span>Refine this list</span>
            <span className="caption-2 text-text-subtle">{QUIZ_STEPS.length} filters</span>
          </label>
          <form method="get" action="/matches" className="mt-4 hidden grid-cols-2 gap-x-3 gap-y-4 peer-checked:grid lg:sticky lg:top-24 lg:mt-0 lg:grid lg:grid-cols-1" aria-label="Filters">
            <p className="kicker col-span-2 hidden text-text lg:col-span-1 lg:block">Refine</p>
            {([
              ["field", "Field", QUIZ_STEPS[0].options],
              ["country", "Country", QUIZ_STEPS[1].options],
              ["remote", "Workplace", QUIZ_STEPS[2].options],
              ["payFloor", "Pay", QUIZ_STEPS[3].options],
              ["level", "Level", QUIZ_STEPS[4].options],
              ["schedule", "Schedule", QUIZ_STEPS[5].options],
            ] as const).map(([key, label, options]) => (
              <label key={key} className="caption-1 flex min-w-0 flex-col gap-1 text-text">
                {label}
                <select name={key} defaultValue={String(answers[key])} className={selectClass}>
                  {options.map((o) => <option key={o.value} value={o.value}>{optionLabel(key, o.label, answers.country)}</option>)}
                </select>
              </label>
            ))}
            <div className="col-span-2 lg:col-span-1"><button type="submit" className={buttonClass("secondary", "md", "w-full")}>Update list</button></div>
          </form>
        </aside>

        <div className="min-w-0 lg:col-span-9">
          {changed ? (
            <div className="mb-6 border border-rule bg-surface-raised p-4">
              {ctx ? (
                <form method="post" action="/api/profile" className="flex flex-wrap items-center gap-3">
                  {QUIZ_STEPS.map((s) => <input key={s.key} type="hidden" name={s.key} value={String(answers[s.key as keyof QuizAnswers])} />)}
                  <p className="body-6 min-w-0 flex-1 text-text">Save these answers to get a daily email of new matches.</p>
                  <button type="submit" className={buttonClass("primary", "md")}>Save and email me</button>
                </form>
              ) : (
                <p className="body-6 text-text">
                  <Link href={`/sign-in?next=${encodeURIComponent(`/matches?${params}`)}`} className="font-semibold text-action underline underline-offset-4 focus-visible:focus-ring">Create a free account</Link> to save your matches and get a daily email of new jobs.
                </p>
              )}
            </div>
          ) : sp.saved ? <p className="mb-6 body-6 text-text" role="status">Saved. Your daily email is on. <Link href="/alerts" className="text-action underline underline-offset-4">Change email settings</Link></p> : null}

          {agencyHidden > 0 ? (
            <p className="body-6 flex items-start gap-2 border-t border-rule bg-surface-raised px-4 py-3 text-text md:px-6">
              <ShieldCheck size={20} weight="bold" aria-hidden className="mt-0.5 shrink-0 text-marker" />
              <span><span className="kicker mr-2 text-marker">Receipt</span><b className="font-semibold">{agencyReceipt(agencyHidden)}</b></span>
            </p>
          ) : null}

          {shown.length === 0 ? (
            <EmptyState
              title="No matches yet"
              body={`Nothing in the job database fits these answers right now. We check company pages ${cadence.checkPhrase}, so try a wider answer or check back soon.`}
              action={<Link href="/quiz" className={buttonClass("primary")}>Change my answers</Link>}
              visual={<div className="w-full max-w-xl" aria-label="Example of a match"><p className="kicker mb-2 text-text-subtle">Example</p><div className="border-y border-rule"><NoticeCard job={sampleJobs[0]!} showTear={false} framed={false} /></div></div>}
            />
          ) : (
            <ul className="divide-y divide-border border-y border-rule bg-surface-raised">
              {shown.map((r) => <li key={r.job.id} className="min-w-0"><JobCard job={r.job} reason={r.reason} now={now} /></li>)}
            </ul>
          )}

          {ranked.length > PAGE_SIZE ? (
            <nav aria-label="Pages" className="mt-6 flex items-center gap-4">
              {page > 1 ? <Link href={pageHref(page - 1)} className={buttonClass("secondary")}>Previous</Link> : null}
              <span className="body-6 figures text-text-subtle">Page {page} of {Math.ceil(ranked.length / PAGE_SIZE)}</span>
              {page * PAGE_SIZE < ranked.length ? <Link href={pageHref(page + 1)} className={buttonClass("secondary")}>Next</Link> : null}
            </nav>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
