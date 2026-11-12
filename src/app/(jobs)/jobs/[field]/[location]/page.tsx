import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobCard } from "@/components/jobs/job-card";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { product } from "@/config/product";
import { getDb } from "@/lib/db";
import { fieldLabel } from "@/lib/jobs/fields";
import { ldScript } from "@/lib/jobs/jobPostingLd";
import { buildIntro, MIN_JOBS_FOR_PAGE, PAGE_LIST_SIZE, pageDescription, pagePath, pageQuery, pageStats, pageTitle, resolvePage } from "@/lib/jobs/seoPages";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

/** Server rendered and cached for an hour: the page is the same for everyone, so it is served from the cache. */
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ field: string; location: string }> };

async function load(p: { field: string; location: string }) {
  const page = resolvePage(p.field, p.location);
  if (!page) return null;
  const db = await getDb();
  const q = pageQuery(page.field, page.location);
  const [total, jobs] = await Promise.all([db.countJobs(q), db.queryJobs({ ...q, limit: PAGE_LIST_SIZE })]);
  if (total < MIN_JOBS_FOR_PAGE) return null; // thin: no page, no sitemap entry
  return { ...page, total, jobs };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(await params);
  if (!data) return { title: "Jobs", robots: { index: false } };
  const stats = pageStats(data.jobs, data.total, new Date());
  return pageMetadata({ title: pageTitle(data.field, data.location), description: pageDescription(data.field, data.location, stats), path: pagePath(data.field, data.location) });
}

export default async function JobsLandingPage({ params }: Props) {
  const data = await load(await params);
  if (!data) notFound();
  const now = new Date();
  const stats = pageStats(data.jobs, data.total, now);
  const intro = buildIntro(data.field, data.location, stats);
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: product.name, item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Jobs", item: absoluteUrl("/jobs") },
      { "@type": "ListItem", position: 3, name: pageTitle(data.field, data.location), item: absoluteUrl(pagePath(data.field, data.location)) },
    ],
  };
  return (
    <Container className="max-w-3xl py-10 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldScript(crumbs) }} />
      <p><Link href="/jobs" className="body-6 text-text-subtle underline underline-offset-4 focus-visible:focus-ring">All job pages</Link></p>
      <h1 className="heading-3 md:heading-1 mt-4 text-text">{pageTitle(data.field, data.location)}</h1>
      <div className="body-4 mt-4 flex flex-col gap-3 text-text-subtle">{intro.map((t) => <p key={t}>{t}</p>)}</div>
      <p className="mt-6"><Link href={`/quiz?field=${data.field}${data.location.country ? `&country=${data.location.country}` : ""}`} className={buttonClass("primary")}>Get matches for your answers</Link></p>
      <h2 className="heading-5 mt-12 text-text">Newest {fieldLabel(data.field).toLowerCase()} jobs {data.location.kind === "remote" ? "that are remote" : `in ${data.location.label}`}</h2>
      <ul className="mt-4 divide-y divide-border border-y border-rule bg-surface-raised">
        {data.jobs.map((j) => <li key={j.id}><JobCard job={j} now={now} /></li>)}
      </ul>
      {data.total > data.jobs.length ? <p className="body-6 mt-4 text-text-subtle">Showing the newest {data.jobs.length} of {data.total.toLocaleString("en-US")}. The quiz narrows the rest to your pay floor, level and schedule.</p> : null}
      <p className="body-6 mt-8 text-text-subtle">Every job links to the employer&apos;s own page. We removed staffing agency posts from this list. <Link href="/how-we-check" className="text-action underline underline-offset-4">How we check</Link></p>
    </Container>
  );
}
