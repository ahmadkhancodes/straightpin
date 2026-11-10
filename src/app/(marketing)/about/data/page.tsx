import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/layout";
import { socialImages } from "@/lib/seo";
import { product } from "@/config/product";
import { EXCERPT_MAX } from "@/lib/crawl/normalize";
import { retentionStatement } from "@/lib/jobs/retention";

const title = "What we store about a job";
const description = "Straightpin keeps facts, a short excerpt and a link to the employer's own page. Not the full posting. Here is the list.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about/data" },
  openGraph: { title: `${title} · ${product.fullName}`, description, url: "/about/data", ...socialImages().openGraph },
  twitter: { title: `${title} · ${product.fullName}`, ...socialImages().twitter },
};

const facts = [
  "Job title, company name and the field we sorted it into",
  "Country, region and place, and whether it is remote, hybrid or on site",
  "Pay, only when the company publishes it, with its period and currency",
  "Level and schedule (full or part time), worked out from the title and excerpt",
  "The company's own first published date, and the date and time we last saw the job",
  "The address of the job on the company's own page, and which hiring system it comes from",
  "Our checks: how many times it was reposted, whether it looks old, and whether it looks agency run",
];

export default function AboutDataPage() {
  const retention = retentionStatement();
  return (
    <Section labelledBy="data-title">
      <h1 id="data-title" className="heading-3 md:heading-1 max-w-3xl text-text">{title}</h1>
      <p className="body-3 md:title-1 mt-4 max-w-2xl text-text-subtle">
        The job belongs to the employer. We keep what is needed to find it, check it and send you to it.
      </p>
      <div className="mt-12 grid max-w-3xl grid-cols-1 gap-12">
        <section aria-labelledby="data-facts">
          <h2 id="data-facts" className="heading-5 text-text">Facts we keep</h2>
          <ul className="body-3 mt-3 grid grid-cols-1 list-disc gap-2 pl-5 text-text-subtle">
            {facts.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </section>
        <section aria-labelledby="data-excerpt">
          <h2 id="data-excerpt" className="heading-5 text-text">A short excerpt, never the whole posting</h2>
          <p className="body-3 mt-3 text-text-subtle">
            We keep the opening of the description, up to {EXCERPT_MAX} characters, as plain text. It helps you tell jobs apart and helps us sort them. The full description, the company&apos;s images and the application form stay on the employer&apos;s page.
          </p>
        </section>
        <section aria-labelledby="data-link">
          <h2 id="data-link" className="heading-5 text-text">A link to the employer</h2>
          <p className="body-3 mt-3 text-text-subtle">
            Every job has an Apply at company button that opens the employer&apos;s own page. You apply to the employer. We do not collect applications, and we do not get a copy of what you send.
          </p>
        </section>
        <section aria-labelledby="data-keep">
          <h2 id="data-keep" className="heading-5 text-text">How long we keep it</h2>
          <ul className="body-3 mt-3 grid grid-cols-1 list-disc gap-2 pl-5 text-text-subtle">
            <li>{retention.closedJobs}</li>
            <li>{retention.crawlRecords}</li>
          </ul>
        </section>
        <section aria-labelledby="data-not">
          <h2 id="data-not" className="heading-5 text-text">What we do not keep</h2>
          <ul className="body-3 mt-3 grid grid-cols-1 list-disc gap-2 pl-5 text-text-subtle">
            <li>Applicant data of any kind, or anything behind a login.</li>
            <li>Jobs that are not in the fields we cover. We drop them when we read them.</li>
          </ul>
        </section>
        <section aria-labelledby="data-ask">
          <h2 id="data-ask" className="heading-5 text-text">Employers: correct it or remove it</h2>
          <p className="body-3 mt-3 text-text-subtle">
            Tell us at <a className="text-action underline underline-offset-4" href={`mailto:${product.supportEmail}?subject=Crawler%20removal%20request`}>{product.supportEmail}</a> or block our crawler as described on the <Link className="text-action underline underline-offset-4" href="/bot">crawler page</Link>. We act within 48 hours.
          </p>
          <p className="body-6 mt-3 text-text-subtle">What we store about <em>you</em> as a job seeker is in the <Link className="text-action underline underline-offset-4" href="/legal/privacy">privacy policy</Link>.</p>
        </section>
      </div>
    </Section>
  );
}
