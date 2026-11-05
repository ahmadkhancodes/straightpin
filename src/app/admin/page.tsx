import { DataTable, Td } from "@/components/app/data-table";
import { PageHeader } from "@/components/app/page-header";
import { fmt } from "@/components/app/labels";
import { Badge } from "@/components/ui/states";
import { adminOverview } from "@/lib/admin";
import { getFlags } from "@/lib/flags";

export default async function AdminPage() {
  const [totals, flags] = await Promise.all([adminOverview(), getFlags()]);
  const stats = [
    { label: "Users", value: totals.users },
    { label: "Organizations", value: totals.orgs },
    { label: "Paid organizations", value: totals.paidOrgs },
  ];
  return (
    <>
      <PageHeader title="Admin overview" description="Totals across every organization. Visible to founder accounts only." />
      <div className="flex flex-col gap-8">
        <dl className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-6">
              <dt className="title-4 text-text-subtle">{s.label}</dt>
              <dd className="heading-4 tabular-nums text-text">{fmt(s.value)}</dd>
            </div>
          ))}
        </dl>
        <section aria-labelledby="flags-h" className="flex flex-col gap-3">
          <h2 id="flags-h" className="title-2 text-text">Feature flags</h2>
          <DataTable caption="Feature flags" columns={[{ key: "flag", label: "Flag" }, { key: "value", label: "Value" }]}>
            {Object.entries(flags).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
              <tr key={k}>
                <Td><code>{k}</code></Td>
                <Td><Badge tone={v === "on" || v === "true" ? "success" : "info"}>{v}</Badge></Td>
              </tr>
            ))}
          </DataTable>
          <p className="caption-2 text-text-subtle">Flags come from product defaults, the config collection and the APP_FLAGS environment variable, in that order.</p>
        </section>
      </div>
    </>
  );
}
