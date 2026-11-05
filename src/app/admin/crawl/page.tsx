import { DataTable, Td } from "@/components/app/data-table";
import { fmt } from "@/components/app/labels";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/states";
import { pct, when } from "@/lib/admin-format";
import { getDb } from "@/lib/db";
import { crawlHealth } from "@/lib/jobs/health";

export const dynamic = "force-dynamic";
export const metadata = { title: "Crawl health" };

const RUNS = 200;

export default async function CrawlHealthPage() {
  const db = await getDb();
  const [employers, runs] = await Promise.all([db.listEmployers(), db.listSourceRuns(RUNS)]);
  const h = crawlHealth(employers, runs);
  const stats = [
    { label: "Overall success", value: pct(h.overallSuccessRate) },
    { label: "Last run", value: when(h.lastRunAt) },
    { label: `Jobs added (last ${h.runs} runs)`, value: fmt(h.added) },
    { label: `Jobs closed (last ${h.runs} runs)`, value: fmt(h.closed) },
  ];
  return (
    <>
      <PageHeader title="Crawl health" description="Per source success rate over the most recent crawl runs. Worst sources first." />
      <dl className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
            <dt className="caption-3 text-text-subtle">{s.label}</dt>
            <dd className="title-2 text-text">{s.value}</dd>
          </div>
        ))}
      </dl>
      <DataTable
        caption="Crawl health per source"
        columns={[
          { key: "source", label: "Source" },
          { key: "ats", label: "Type" },
          { key: "status", label: "Status" },
          { key: "rate", label: "Success rate", align: "right" },
          { key: "last", label: "Last crawl" },
          { key: "added", label: "Added", align: "right" },
          { key: "closed", label: "Closed", align: "right" },
          { key: "err", label: "Last error" },
        ]}
      >
        {h.sources.map((s) => (
          <tr key={s.employerId}>
            <Td>{s.name}</Td>
            <Td muted>{s.ats}</Td>
            <Td><Badge tone={s.status === "active" ? "success" : s.status === "dead" ? "danger" : "warning"}>{s.status}</Badge></Td>
            <Td align="right">{pct(s.successRate)} <span className="text-text-subtle">({s.ok}/{s.runs})</span></Td>
            <Td muted>{when(s.lastCrawledAt)}</Td>
            <Td align="right">{fmt(s.added)}</Td>
            <Td align="right">{fmt(s.closed)}</Td>
            <Td muted className="max-w-64 truncate">{s.lastError ?? ""}</Td>
          </tr>
        ))}
      </DataTable>
      {h.sources.length === 0 ? <p className="body-6 mt-4 text-text-subtle">No sources yet. The first crawl tick seeds the list.</p> : null}
    </>
  );
}
