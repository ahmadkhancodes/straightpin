import type { Metadata } from "next";
import { Section } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { NoticeCard } from "@/components/marketing/notice-card";
import { sampleJobs } from "@/content/sample-jobs";
import { socialImages } from "@/lib/seo";
import { cadence, product } from "@/config/product";

const title = "How we check every job";
const description = "Plain words on how Straightpin checks that a job comes from the employer's own page, whether it was reposted, and whether it looks old or agency run.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/how-we-check" },
  openGraph: { title: `${title} · ${product.fullName}`, description, url: "/how-we-check", ...socialImages().openGraph },
  twitter: { title: `${title} · ${product.fullName}`, ...socialImages().twitter },
};

const checks = [
  {
    id: "source",
    title: "1. Is it on the company's own page?",
    body: [
      "Companies post jobs in a hiring system (often called an ATS, the hiring system companies use) or on their own careers page. We read those pages directly. We do not copy listings from other job boards.",
      "Every job shows the website it came from, such as jobs.lever.co, and when we last checked it. The Apply at company tab opens that page, so you apply to the employer and not to us.",
      `We read company hiring pages ${cadence.checkPhrase}, so a job that closed an hour ago can stay listed until the next crawl.`,
    ],
  },
  {
    id: "repost",
    title: "2. Was it posted before?",
    body: [
      "We keep the first date we saw a job and show it as the posted date. If the same job disappears and comes back, we count it as a repost.",
      "A job reposted in the last 90 days says so on the card, for example \"Reposted 3 times\". A job with no repost says \"Never reposted\".",
    ],
  },
  {
    id: "ghost",
    title: "3. Does it look like a ghost job?",
    body: [
      "A ghost job is a listing that is not really being filled. We cannot see inside a company, so we do not say a job is a ghost. We show the signs we can measure and you decide.",
      "A job posted more than 30 days ago gets an Old posting label with its age. A job whose closing date has already passed gets a warning too. Some postings stay up long after the company stopped hiring, which is why the date matters.",
    ],
  },
  {
    id: "agency",
    title: "4. Is a staffing agency behind it?",
    body: [
      "Agencies often post the same role again and again for clients you cannot see. We check each posting against known agency names and typical agency wording, and we take out the ones that match.",
      "The list tells you how many we removed, for example \"We removed 41 staffing agency posts from this list\". This is a filter, not a perfect one. If you see an agency post that slipped through, tell us and we review it.",
    ],
  },
];

export default function HowWeCheckPage() {
  return (
    <>
      <Section labelledBy="hwc-title">
        <h1 id="hwc-title" className="heading-3 md:heading-1 max-w-3xl text-text">{title}</h1>
        <p className="body-3 md:title-1 mt-4 max-w-2xl text-text-subtle">
          Four checks, in plain words. Every job card shows the result.
        </p>
        <ol className="mt-12 grid max-w-3xl gap-12">
          {checks.map((c) => (
            <li key={c.id} aria-labelledby={`c-${c.id}`}>
              <h2 id={`c-${c.id}`} className="heading-5 text-text">{c.title}</h2>
              <div className="mt-3 grid gap-3">
                {c.body.map((b) => <p key={b} className="body-3 text-text-subtle">{b}</p>)}
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Section tone="raised" labelledBy="example-title">
        <h2 id="example-title" className="heading-4 text-text">What you see on a job</h2>
        <p className="body-3 mt-3 max-w-2xl text-text-subtle">Two illustrated notices. The companies are made up.</p>
        <div className="mt-8 grid max-w-3xl gap-4 md:grid-cols-2">
          <NoticeCard job={sampleJobs[0]!} />
          <NoticeCard job={sampleJobs[5]!} showTear={false} />
        </div>
        <p className="body-6 mt-8 max-w-2xl text-text-subtle">
          What we do not do: we do not apply for you, write your resume with AI, or take a cut of your pay. We are not a recruiter. We never say another site&apos;s jobs are fake.
        </p>
        <div className="mt-8"><ButtonLink href="/#pick-field" size="lg">Pick your field, see your matches</ButtonLink></div>
      </Section>
    </>
  );
}
