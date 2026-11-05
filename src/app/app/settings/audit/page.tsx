import Link from "next/link";
import { DataTable, Td } from "@/components/app/data-table";
import { formatDate } from "@/components/app/api";
import { PageHeader } from "@/components/app/page-header";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/states";
import { can } from "@/lib/auth/roles";
import { requireOrg } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

export const metadata = { title: "Audit log" };

const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireOrg({ page: true });
  if (!can(ctx.role, "audit", "read")) {
    return (
      <>
        <PageHeader title="Audit log" />
        <Notice title="Owners and admins only">The audit log records who changed what. Ask an owner or admin if you need to see it.</Notice>
      </>
    );
  }
  const raw = Array.isArray(sp.before) ? sp.before[0] : sp.before;
  const parsed = raw ? new Date(raw) : null;
  const before = parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
  const db = await getDb();
  const rows = await db.listAudit(ctx.org.id, { limit: PAGE + 1, before });
  const more = rows.length > PAGE;
  const shown = rows.slice(0, PAGE);
  const last = shown[shown.length - 1];
  return (
    <>
      <PageHeader title="Audit log" description="An append-only record of sensitive actions in this organization, newest first." />
      {shown.length === 0 ? (
        <EmptyState
          title={before ? "Nothing older than this" : "No activity recorded yet"}
          body={before ? "You have reached the start of the log." : "Sign-ins, role changes, key creation and billing events show up here as they happen."}
          action={before ? <Link href="/app/settings/audit" className={buttonClass("secondary")}>Back to newest</Link> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <DataTable
            maxHeight
            caption="Audit log"
            columns={[
              { key: "action", label: "Action" },
              { key: "actor", label: "Actor" },
              { key: "target", label: "Target" },
              { key: "at", label: "Time" },
            ]}
          >
            {shown.map((r) => (
              <tr key={r.id}>
                <Td><code>{r.action}</code></Td>
                <Td muted>{r.actorId ?? "System"}</Td>
                <Td muted className="break-all">{r.target ?? "None"}</Td>
                <Td muted><time dateTime={r.at.toISOString()}>{formatDate(r.at, true)}</time></Td>
              </tr>
            ))}
          </DataTable>
          <div className="flex gap-2">
            {before ? <Link href="/app/settings/audit" className={buttonClass("secondary")}>Newest</Link> : null}
            {more && last ? <Link href={`/app/settings/audit?before=${encodeURIComponent(last.at.toISOString())}`} className={buttonClass("secondary")}>Older</Link> : null}
          </div>
        </div>
      )}
    </>
  );
}
