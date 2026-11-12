import { socialImages } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Container, Section } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import {
  CompareTable, Faq, FinalCta, HowItWorks, PricingTable, TaglineReveal,
  type FaqItem, type Step,
} from "@/components/marketing";
import { NoticeCard } from "@/components/marketing/notice-card";
import { FieldPicker } from "@/components/marketing/field-picker";
import { comparisons } from "@/content/compare";
import { jobsForField, sampleFields, sampleJobs } from "@/content/sample-jobs";
import { cadence, freePlan, planById, product } from "@/config/product";
import { getCrawlStats, getFieldCounts, statsLine } from "@/lib/jobs/stats";

export const revalidate = 300;

const pageTitle = "Straightpin by BufferSol: jobs straight from company careers pages";
const pageDescription =
  "Jobs posted on the employer's own careers page, staffing agencies removed, first posted date on every job. Free to start. $10.99 a month, 7 day refund.";

export const metadata: Metadata = {
  title: { absolute: pageTitle },
  description: pageDescription,
  alternates: { canonical: "/" },
  openGraph: { title: pageTitle, description: pageDescription, url: "/", ...socialImages().openGraph },
  twitter: { title: pageTitle, ...socialImages().twitter },
};

const monthly = planById("monthly")?.prices[0];
const weekly = planById("weekly")?.prices[0];
const cents = (c: number) => `$${(c / 100).toFixed(2)}`;
const PRICE_LINE = `Free to start. Then ${cents(monthly?.usd ?? 0)} a month, or ${cents(weekly?.usd ?? 0)} a week. Cancel in two taps. ${product.refundDays} day refund.`;

const heroJobs = [sampleJobs[0]!, sampleJobs[3]!, sampleJobs[5]!];

const faq: FaqItem[] = [
  { q: "Is this a scam?", a: `We show the price before you sign up, we refund your first payment within ${product.refundDays} days, and we are not a recruiter and never take a cut of your pay. Every job links to the employer's own page, and you apply there as yourself.` },
  { q: "Why pay to see jobs?", a: "Honestly, you do not have to. HiringCafe is free and has more jobs. We sell guided matching, alerts and the trust signals on every job: the first posted date, the repost count and the agency check. The free tier is real: 5 job opens a day, 10 saved jobs and a daily email." },
  { q: "How do you remove agencies?", a: "We compare each posting with known staffing agency patterns and flag the ones that match. Posts we remove are counted in a receipt at the top of your list. See How we check for the plain version." },
  { q: "How often do you check for new jobs?", a: `We read company hiring pages ${cadence.checkPhrase} and show when each job was last checked. Free accounts get ${cadence.digestPhrase}. Paid plans get saved alerts ${cadence.alertPhrase}.` },
  { q: "How do you verify jobs?", a: `We read the company's own hiring page, check it again ${cadence.checkPhrase}, and show the website each job comes from and when we last checked it.` },
  { q: "How is this different from Indeed or LinkedIn?", a: "Many jobs on the big boards come from staffing agencies or sit unfilled for months. We read company career pages directly. We do not say any other site's jobs are fake. We show dates and repost counts so you can judge." },
  { q: "Will you apply for me, or write my resume with AI?", a: "No, on purpose. Real jobs, you apply as yourself." },
  { q: "What if I forget to cancel?", a: "We email a renewal reminder before every renewal, with the date and amount. Cancel in two taps from Billing. If you were charged and did not mean to be, ask within 7 days of your first payment for a full refund." },
  { q: "Which countries?", a: "The United States now, plus Canada and the UK. Prices are in US dollars for now. Local prices at checkout come later." },
  { q: "Where do jobs come from?", a: "From employers' hiring systems and careers pages, which are public. We respect each site's robots.txt rules and ask for pages slowly." },
  { q: "How do I get a refund?", a: `Email ${product.supportEmail} within ${product.refundDays} days of your first payment. Full refund, no questions.` },
];

const steps: Step[] = [
  {
    title: "Pick your field",
    body: "Tap the kind of work you want. We count the real matches as you answer.",
    visual: (
      <div className="border border-border bg-surface-raised p-4">
        <p className="flex items-center gap-3">
          <span aria-hidden className="heading-5 figures border border-rule bg-surface px-2 text-text">312</span>
          <span className="body-6 text-text-subtle">matches so far (example)</span>
        </p>
        <p className="mt-3 flex flex-wrap gap-2">
          {sampleFields.slice(0, 3).map((f, i) => (
            <span key={f.id} className={i === 0 ? "button-sm rounded-md border border-rule bg-highlight px-4 py-2 text-on-highlight" : "button-sm rounded-md border border-border-strong bg-surface px-4 py-2 text-text"}>{f.label}</span>
          ))}
        </p>
      </div>
    ),
  },
  {
    title: "Get your matches",
    body: "Open up to 5 jobs a day free. Every title and company stays visible.",
    visual: (
      <div className="grid gap-3">
        <p className="body-6 flex items-start gap-2 border border-border bg-surface-raised p-3 text-text">
          <ShieldCheck size={20} weight="bold" aria-hidden className="mt-0.5 shrink-0 text-marker" />
          <span><span className="kicker mr-2 text-marker">Receipt</span><b className="font-semibold">We removed 41 staffing agency posts from this list.</b> <span className="text-text-subtle">Example.</span></span>
        </p>
        <NoticeCard job={jobsForField("support")[1]!} showTear={false} />
      </div>
    ),
  },
  {
    title: "Apply at the company",
    body: "The tab shows the employer's own website. Tap it and their page opens.",
    visual: <NoticeCard job={jobsForField("support")[0]!} />,
  },
];

/** "How to read a listing": numbered notes beside one real listing row (replaces a feature grid). */
const anatomy: { term: string; body: string }[] = [
  { term: "Direct to company", body: "The job came from the employer's own careers page or hiring system, and our agency check did not flag it." },
  { term: "Posted date", body: "The day the company first posted it, never the day it was last edited. Reposts do not reset it." },
  { term: "Repost count", body: "How many times the same role came back in the last 90 days. Three or more is worth a second look." },
  { term: "Old posting", body: "Over 30 days old, it says so in words, next to a warning mark. Some old jobs are real. You decide." },
  { term: "Source website", body: "Printed on every job, so you know whose page you are about to open before you tap." },
];

export default async function HomePage() {
  const stats = await getCrawlStats();
  const real = await getFieldCounts(stats.total);
  const directroles = comparisons[0]!;
  const miniRows = directroles.rows.filter((r) => ["Monthly price", "Price shown before sign up", "Refund window"].includes(r.label));
  return (
    <>
      <section aria-labelledby="hero-title" className="bg-surface pb-12 pt-6 lg:pb-16 lg:pt-12">
        <Container>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule pb-3">
            <p className="kicker text-text-subtle">Help wanted, from the employer</p>
            <p className="caption-2 text-text-subtle" data-testid="crawl-stats">{statsLine(stats)}</p>
          </div>
          <div className="grid grid-cols-1 gap-10 pt-8 lg:grid-cols-12 lg:gap-0 lg:pt-12">
            <div className="min-w-0 lg:col-span-7 lg:pr-12">
              <h1 id="hero-title" className="heading-3 md:heading-1 max-w-[680px] text-text">
                Jobs straight from company careers pages. Half the price.
              </h1>
              <p className="title-2 mt-6 max-w-[600px] text-text-subtle">
                {`We check company hiring pages ${cadence.checkPhrase}, drop staffing agency reposts, and show you when each job was really posted.`}
              </p>
              <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4 border-t border-border pt-6">
                <p className="flex flex-col">
                  <span className="heading-3 figures text-text"><span className="bg-highlight px-1 text-on-highlight">{cents(monthly?.usd ?? 0)}</span></span>
                  <span className="body-6 mt-1 text-text-subtle">a month, or {cents(weekly?.usd ?? 0)} a week</span>
                </p>
                <p className="body-6 max-w-[280px] text-text-subtle">Free to start. Cancel in two taps. {product.refundDays} day refund on your first payment.</p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                <ButtonLink href="#pick-field" size="lg">
                  Pick your field, see your matches
                  <ArrowRight size={20} weight="bold" aria-hidden />
                </ButtonLink>
                <Link href="/how-we-check" className="body-5 inline-flex min-h-11 items-center text-text underline underline-offset-4 focus-visible:focus-ring">
                  How we check every job
                </Link>
              </div>
              <p className="sr-only">{PRICE_LINE}</p>
            </div>
            <div className="min-w-0 lg:col-span-5 lg:border-l lg:border-rule lg:pl-12" aria-label="Illustration of job listings">
              <h2 className="kicker flex items-baseline justify-between border-b-2 border-rule pb-2 text-text">
                <span>Customer support</span><span className="font-normal text-text-subtle">example</span>
              </h2>
              <ul className="divide-y divide-border border-b border-border bg-surface-raised">
                {heroJobs.map((j, i) => (
                  <li key={j.id}><NoticeCard job={j} showTear={i === 0} framed={false} /></li>
                ))}
              </ul>
              <p className="caption-2 mt-3 text-text-subtle">Illustration: made up companies, shown to explain the listing layout.</p>
            </div>
          </div>
        </Container>
      </section>

      <Section id="pick-field" labelledBy="pick-title" className="scroll-mt-16" tone="raised" space="sm" head="Pick a field">
        <h2 id="pick-title" className="heading-4 md:heading-3 max-w-2xl text-text">Pick your field. We&apos;ll count real matches as you answer.</h2>
        <div className="mt-6">
          <FieldPicker withList headingId="pick-title" real={real ?? undefined} />
        </div>
      </Section>

      <Section labelledBy="problem-title" space="lg" head="The problem">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <h2 id="problem-title" className="heading-3 md:heading-1 text-text lg:col-span-7">Most of the job boards you scroll are showing you the wrong jobs.</h2>
          <div className="flex flex-col gap-6 lg:col-span-5 lg:pt-4">
            <p className="title-1 text-text">Many jobs on the big boards come from staffing agencies or sit unfilled for months.</p>
            <p className="body-3 text-text-subtle">Staffing agencies repost the same role again and again. You apply, nobody answers.</p>
            <p className="body-3 text-text-subtle">
              Some listings are not being filled at all. So every job here shows when the company first posted it and how often it was reposted.
            </p>
            <p className="heading-5 text-text"><span className="bg-highlight px-1 text-on-highlight">Check the date.</span></p>
          </div>
        </div>
      </Section>

      <TaglineReveal text="Every job comes from the company's own page. Every date is the real first posted date. Nothing between you and the employer." />

      <HowItWorks title="How it works" steps={steps} head="Three steps" />

      <Section labelledBy="anatomy-title" tone="raised" space="md" head="How to read a listing">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="min-w-0 lg:col-span-5">
            <h2 id="anatomy-title" className="heading-4 md:heading-2 text-text">What is on every listing</h2>
            <div className="mt-8 border-y border-rule lg:sticky lg:top-24">
              <NoticeCard job={sampleJobs[5]!} showTear={false} framed={false} />
            </div>
            <p className="caption-2 mt-3 text-text-subtle">Illustration with a made up company.</p>
          </div>
          <ol className="min-w-0 divide-y divide-border border-t-2 border-rule lg:col-span-7">
            {anatomy.map((n, i) => (
              <li key={n.term} className="grid grid-cols-[48px_1fr] gap-x-4 py-6">
                <span aria-hidden className="figures heading-5 text-text">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="title-1 font-semibold text-text">{n.term}</h3>
                  <p className="body-3 mt-1 text-text-subtle">{n.body}</p>
                </div>
              </li>
            ))}
            <li className="grid grid-cols-[48px_1fr] gap-x-4 py-6">
              <span aria-hidden className="figures heading-5 text-text">06</span>
              <div>
                <h3 className="title-1 font-semibold text-text">A real free tier</h3>
                <p className="body-3 mt-1 text-text-subtle">{`${freePlan.limits.opens} free job opens a day, ${freePlan.limits.saves} saved jobs and a daily email. Paid plans add ${cadence.alertShort}. No card to start.`}</p>
              </div>
            </li>
          </ol>
        </div>
      </Section>

      <Section labelledBy="compare-title" space="md" head="Compared">
        <h2 id="compare-title" className="heading-4 md:heading-2 max-w-2xl text-text">Same idea as the pricier sites. About half the price.</h2>
        <p className="body-3 mt-4 text-text-subtle">directroles.net: $21 a month. {product.fullName}: {cents(monthly?.usd ?? 0)} a month. Prices checked {directroles.checked}.</p>
        <div className="mt-8">
          <CompareTable caption="Straightpin compared with directroles.net" columns={[directroles.competitor, product.name]} highlightColumn={1} rows={miniRows.map((r) => ({ label: r.label, values: [...r.values] }))} />
        </div>
        <p className="mt-4">
          <Link href="/compare/directroles" className="body-4 inline-flex min-h-11 items-center text-action underline decoration-2 underline-offset-4 focus-visible:focus-ring">The full comparison</Link>
        </p>
      </Section>

      <Section tone="raised" labelledBy="pricing-title" space="lg" head="Prices">
        <PricingTable title="What we charge, full stop." compact />
      </Section>

      <Faq items={faq} title="Questions, answered" head="Questions" />

      <FinalCta
        title="Pick your field. See what is open today."
        body={PRICE_LINE}
        cta={{ href: "#pick-field", label: "Pick your field, see your matches" }}
        note="No card needed to start."
      />
    </>
  );
}
