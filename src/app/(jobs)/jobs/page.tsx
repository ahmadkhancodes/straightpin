import Link from "next/link";
import { Container } from "@/components/ui/layout";
import { getDb } from "@/lib/db";
import { FIELDS } from "@/lib/jobs/fields";
import { generatePagesCached, MIN_JOBS_FOR_PAGE, pagePath } from "@/lib/jobs/seoPages";
import { getCrawlStats, statsLine } from "@/lib/jobs/stats";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Jobs direct from company, by field and place",
  description: "Customer support, data entry, admin, project, sales, operations, finance and marketing jobs in the US, Canada and the UK, straight from company careers pages.",
  path: "/jobs",
});

export default async function JobsIndexPage() {
  const stats = await getCrawlStats();
  const combos = await generatePagesCached(await getDb()).catch(() => []);
  return (
    <Container className="max-w-3xl py-10 md:py-16">
      <h1 className="heading-3 md:heading-1 text-text">Jobs direct from company</h1>
      <p className="body-4 mt-4 text-text-subtle">Pick a field and a place. A page appears once at least {MIN_JOBS_FOR_PAGE} open jobs match, so every list here is real and current.</p>
      <p className="body-6 mt-3 text-text" data-testid="crawl-stats">{statsLine(stats)}</p>
      {combos.length === 0 ? <p className="body-5 mt-8 text-text-subtle">Pages appear here as soon as the crawl has filled the job list.</p> : null}
      {FIELDS.map((f) => {
        const rows = combos.filter((c) => c.field === f.id);
        return rows.length === 0 ? null : (
          <section key={f.id} aria-labelledby={`f-${f.id}`} className="mt-10">
            <h2 id={`f-${f.id}`} className="heading-5 text-text">{f.label}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {rows.map((c) => <li key={c.location.slug}><Link href={pagePath(c.field, c.location)} className="caption-1 inline-block min-h-8 rounded-sm border border-border bg-surface-raised px-3 py-1.5 text-text focus-visible:focus-ring hover:underline">{c.location.label.replace(/^the /, "")} · {c.count.toLocaleString("en-US")}</Link></li>)}
            </ul>
          </section>
        );
      })}
    </Container>
  );
}
