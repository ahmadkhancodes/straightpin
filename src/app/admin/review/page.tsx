import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { labelGate } from "@/lib/classify/labels";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agency review queue" };

export default async function ReviewQueuePage() {
  const db = await getDb();
  const [pending, labels] = await Promise.all([db.listPendingAgency(25), db.listLabels()]);
  const gate = labelGate(labels);
  return (
    <>
      <PageHeader title="Agency review queue" description="Posts the rules were unsure about. Confirm it is an agency to hide it, reject to show it as direct. Every answer is saved as a training label." />
      <div className="mb-6">
        <Notice tone={gate.passes ? "success" : "info"} title={gate.passes ? "Model clears the precision gate" : "Model stays off"}>
          {gate.labelled} labels ({gate.agency} agency, {gate.direct} direct). The gate needs {gate.needed}.
          {gate.metrics ? ` Held out precision ${(gate.metrics.precision * 100).toFixed(1)}%, recall ${(gate.metrics.recall * 100).toFixed(1)}%.` : ""}
        </Notice>
      </div>
      {pending.length === 0 ? <p className="body-4 text-text-subtle">Nothing to review right now.</p> : null}
      <ul className="flex flex-col gap-4">
        {pending.map((j) => (
          <li key={j.id} className="flex flex-col gap-3 border border-border bg-surface p-4">
            <div>
              <p className="title-3 text-text">{j.title}</p>
              <p className="body-6 text-text-subtle">{j.employerName} · {j.sourceHost} · score {j.agencyScore.toFixed(2)}</p>
            </div>
            <p className="body-6 line-clamp-3 text-text-subtle">{j.excerpt}</p>
            <form method="post" action="/api/admin/review" className="flex flex-wrap gap-2">
              <input type="hidden" name="jobId" value={j.id} />
              <Button type="submit" name="label" value="agency" variant="danger">Confirm agency</Button>
              <Button type="submit" name="label" value="direct" variant="secondary">Reject, it is direct</Button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
