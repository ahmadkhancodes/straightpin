import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Container, Section } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import {
  CompareTable, Faq, Features, FinalCta, HowItWorks, PricingTable, TaglineReveal,
  type FaqItem, type Feature, type Step,
} from "@/components/marketing";
import { NoticeCard } from "@/components/marketing/notice-card";
import { FieldPicker } from "@/components/marketing/field-picker";
import { comparisons } from "@/content/compare";
import { jobsForField, sampleFields, sampleJobs } from "@/content/sample-jobs";
import { freePlan, planById, product } from "@/config/product";

const pageTitle = "Straightpin by BufferSol: jobs straight from company careers pages";
const pageDescription =
  "Jobs posted on the employer's own careers page, staffing agencies removed, first posted date on every job. Free to start. $10.99 a month, 7 day refund.";

export const metadata: Metadata = {
  title: { absolute: pageTitle },
  description: pageDescription,
  alternates: { canonical: "/" },
  openGraph: { title: pageTitle, description: pageDescription, url: "/" },
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
  { q: "How do you verify jobs?", a: "We read the company's own hiring page, check it again on a schedule, and show the website each job comes from and when we last checked it." },
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
      <div className="rounded-lg border border-border bg-surface-raised p-4">
        <p className="flex items-center gap-3">
          <span aria-hidden className="heading-5 rounded-sm border border-border bg-surface px-2 tabular-nums text-text">312</span>
          <span className="body-6 text-text-subtle">matches so far (sample)</span>
        </p>
        <p className="mt-3 flex flex-wrap gap-2">
          {sampleFields.slice(0, 3).map((f, i) => (
            <span key={f.id} className={i === 0 ? "button-sm rounded-full border border-action bg-brand-tint px-4 py-2 text-action" : "button-sm rounded-full border border-border bg-surface px-4 py-2 text-text"}>{f.label}</span>
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
        <p className="body-6 flex items-start gap-2 rounded-sm border border-dashed border-border bg-surface-raised p-3 text-text">
          <ShieldCheck size={20} weight="regular" aria-hidden className="mt-0.5 shrink-0 text-action" />
          <span><b className="font-semibold">We removed 41 staffing agency posts from this list.</b> <span className="text-text-subtle">Sample.</span></span>
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

const features: Feature[] = [
  {
    title: "A date and a source on every job",
    body: "Posted 2 days ago. Never reposted. Checked 14 min ago. The website it comes from is printed on the card.",
    span: 4,
    visual: (
      <p className="body-4 flex flex-wrap gap-x-3 gap-y-1 p-4 text-text">
        <span>Posted 2 days ago</span><span className="text-text-subtle">Never reposted</span><span className="text-text-subtle">Checked 14 min ago</span>
        <span className="self-center font-mono text-xs text-text-subtle">jobs.lever.co</span>
      </p>
    ),
  },
  { title: "Agency receipt", body: "We removed 41 staffing agency posts from this list. You see what we took out.", span: 2 },
  {
    title: "Old posting label",
    body: "A job posted 41 days ago says so, with a warning mark and the word.",
    span: 2,
    visual: <div className="p-4"><NoticeCard job={sampleJobs[5]!} showTear={false} /></div>,
  },
  { title: "Alerts", body: "Free: a daily email at 8:00. Paid: an email soon after a new job is posted. We aim for under an hour and publish the real number once we measure it.", span: 4 },
  { title: "A real free tier", body: `${freePlan.limits.opens} free job opens a day. ${freePlan.limits.saves} saved jobs. Daily digest. No card.`, span: 3 },
  { title: "An honest note", body: "HiringCafe is free and has more jobs. We sell guided matching, alerts and trust signals.", span: 3 },
];

export default function HomePage() {
  const directroles = comparisons[0]!;
  const miniRows = directroles.rows.filter((r) => ["Monthly price", "Price shown before sign up", "Refund window"].includes(r.label));
  return (
    <>
      <section aria-labelledby="hero-title" className="bg-surface pb-12 pt-8 lg:pb-20 lg:pt-16">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-16">
            <div className="min-w-0 lg:col-span-7">
              <h1 id="hero-title" className="heading-3 md:heading-1 max-w-[680px] text-text">
                Jobs straight from company careers pages. Half the price.
              </h1>
              <p className="title-2 mt-4 max-w-[680px] text-text-subtle">
                We check company hiring pages every hour, drop staffing agency reposts, and show you when each job was really posted.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                <ButtonLink href="#pick-field" size="lg">
                  Pick your field, see your matches
                  <ArrowRight size={20} weight="regular" aria-hidden />
                </ButtonLink>
                <Link href="/how-we-check" className="body-6 inline-flex min-h-11 items-center text-text underline underline-offset-4 focus-visible:focus-ring">
                  How we check every job
                </Link>
              </div>
              <p className="body-6 mt-4 flex flex-wrap items-baseline gap-x-2">
                <strong className="body-3 font-bold text-text">{cents(monthly?.usd ?? 0)} a month</strong>
                <span className="text-text-subtle">{PRICE_LINE}</span>
              </p>
              <p className="caption-2 mt-4 text-text-subtle">Live job counts start when our crawl goes live. The notices shown here are samples.</p>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 lg:col-span-5" aria-label="Sample job notices">
              {heroJobs.map((j, i) => (
                <div key={j.id} className={i === 1 ? "lg:ml-8" : i === 2 ? "lg:ml-2" : ""}>
                  <NoticeCard job={j} showTear={i < 2} />
                </div>
              ))}
              <p className="caption-2 text-text-subtle">Sample notices. Companies are made up and not affiliated with Straightpin.</p>
            </div>
          </div>
        </Container>
      </section>

      <Section id="pick-field" labelledBy="pick-title" className="scroll-mt-16 !pt-0">
        <h2 id="pick-title" className="heading-5 md:heading-4 max-w-2xl text-text">Pick your field. We&apos;ll count real matches as you answer.</h2>
        <div className="mt-6">
          <FieldPicker withList headingId="pick-title" />
        </div>
      </Section>

      <Section tone="raised" labelledBy="problem-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <h2 id="problem-title" className="heading-4 md:heading-2 text-text lg:col-span-5">Most of the job boards you scroll are showing you the wrong jobs.</h2>
          <div className="flex flex-col gap-8 lg:col-span-6 lg:col-start-7">
            <p className="title-1 text-text">Many jobs on the big boards come from staffing agencies or sit unfilled for months.</p>
            <p className="body-3 text-text-subtle">Staffing agencies repost the same role again and again. You apply, nobody answers.</p>
            <p className="body-3 text-text-subtle">
              Some listings are not being filled at all. So every job here shows when the company first posted it and how often it was reposted.
            </p>
            <p className="font-note text-2xl leading-8 text-marker">Check the date.</p>
          </div>
        </div>
      </Section>

      <TaglineReveal text="Every job comes from the company's own page. Every date is the real first posted date. Nothing between you and the employer." />

      <HowItWorks title="How it works" steps={steps} />

      <Features title="What is on every notice" items={features} />

      <Section labelledBy="compare-title">
        <h2 id="compare-title" className="heading-4 md:heading-2 max-w-2xl text-text">Same idea as the pricier sites. About half the price.</h2>
        <p className="body-3 mt-4 text-text-subtle">directroles.net: $21 a month. {product.fullName}: {cents(monthly?.usd ?? 0)} a month. Prices checked {directroles.checked}.</p>
        <div className="mt-8">
          <CompareTable caption="Straightpin compared with directroles.net" columns={[directroles.competitor, product.name]} highlightColumn={1} rows={miniRows.map((r) => ({ label: r.label, values: [...r.values] }))} />
        </div>
        <p className="mt-4">
          <Link href="/compare/directroles" className="body-4 inline-flex min-h-11 items-center text-action underline underline-offset-4 focus-visible:focus-ring">The full comparison</Link>
        </p>
      </Section>

      <Section tone="raised" labelledBy="pricing-title">
        <PricingTable title="What we charge, full stop." compact />
      </Section>

      <Faq items={faq} title="Questions, answered" />

      <FinalCta
        title="Pick your field. See what is open today."
        body={PRICE_LINE}
        cta={{ href: "#pick-field", label: "Pick your field, see your matches" }}
        note="No card needed to start."
      />
    </>
  );
}
