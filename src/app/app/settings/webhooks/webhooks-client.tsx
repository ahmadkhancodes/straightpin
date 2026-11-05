"use client";
import { useState } from "react";
import { api, formatDate, useAsync } from "@/components/app/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { SecretReveal } from "@/components/app/copy-button";
import { DataTable, Td } from "@/components/app/data-table";
import { Panel } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, EmptyState, ErrorState, Notice, Skeleton } from "@/components/ui/states";

interface Endpoint { id: string; url: string; events: string[]; enabled: boolean; createdAt: string }
interface Delivery { id: string; event: string; status: string; attempts: number; lastStatusCode: number | null; lastError: string | null; createdAt: string; nextAttemptAt: string | null }

const TONE: Record<string, "info" | "success" | "warning" | "danger"> = { succeeded: "success", failed: "danger", retrying: "warning", pending: "info" };

export function WebhooksClient({ canManage, events }: { canManage: boolean; events: string[] }) {
  const endpoints = useAsync(async () => {
    const r = await api<{ endpoints: Endpoint[] }>("/api/webhooks");
    if (!r.ok) throw new Error(r.message);
    return r.data.endpoints;
  });
  const [filter, setFilter] = useState("");
  const deliveries = useAsync(async () => {
    const r = await api<{ deliveries: Delivery[] }>(`/api/webhooks/deliveries${filter ? `?endpointId=${encodeURIComponent(filter)}` : ""}`);
    if (!r.ok) throw new Error(r.message);
    return r.data.deliveries;
  }, [filter]);

  const [url, setUrl] = useState("");
  const [picked, setPicked] = useState<string[]>(["*"]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ url: string; secret: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<Endpoint | null>(null);

  const toggleEvent = (ev: string) => setPicked((p) => (p.includes(ev) ? p.filter((x) => x !== ev) : [...p, ev]));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    let ok = false;
    try { ok = new URL(url.trim()).protocol === "https:"; } catch { ok = false; }
    if (!ok) return setFormError("Enter a full URL that starts with https://.");
    if (picked.length === 0) return setFormError("Pick at least one event.");
    setCreating(true);
    setFormError(null);
    const r = await api<{ endpoint: Endpoint; secret: string }>("/api/webhooks", { body: { url: url.trim(), events: picked } });
    setCreating(false);
    if (!r.ok) return setFormError(r.message);
    setSecret({ url: r.data.endpoint.url, secret: r.data.secret });
    setUrl("");
    setPicked(["*"]);
    endpoints.reload();
  }

  async function toggle(ep: Endpoint) {
    setBusy(ep.id);
    const r = await api(`/api/webhooks/${ep.id}`, { method: "PATCH", body: { enabled: !ep.enabled } });
    setBusy(null);
    if (!r.ok) return setNotice({ ok: false, text: r.message });
    setNotice({ ok: true, text: `${ep.enabled ? "Paused" : "Resumed"} deliveries to ${ep.url}.` });
    endpoints.reload();
  }

  async function test(ep: Endpoint) {
    setBusy(`t${ep.id}`);
    const r = await api(`/api/webhooks/${ep.id}/test`, { body: {} });
    setBusy(null);
    if (!r.ok) return setNotice({ ok: false, text: r.message });
    setNotice({ ok: true, text: `Test event queued for ${ep.url}. Check the log below in a few seconds.` });
    deliveries.reload();
  }

  async function remove() {
    if (!removing) return;
    setBusy(removing.id);
    const r = await api(`/api/webhooks/${removing.id}`, { method: "DELETE" });
    setBusy(null);
    const gone = removing.url;
    setRemoving(null);
    if (!r.ok) return setNotice({ ok: false, text: r.message });
    setNotice({ ok: true, text: `Endpoint ${gone} deleted.` });
    if (filter === removing.id) setFilter("");
    endpoints.reload();
    deliveries.reload();
  }

  return (
    <div className="flex flex-col gap-6">
      {!canManage ? <Notice title="Read only">Only owners and admins can add, pause or delete endpoints.</Notice> : null}
      {secret ? <SecretReveal title={`Signing secret for ${secret.url}`} value={secret.secret} onDismiss={() => setSecret(null)} /> : null}
      {notice ? <p role={notice.ok ? "status" : "alert"} className={notice.ok ? "caption-2 text-success" : "caption-2 text-danger"}>{notice.text}</p> : null}

      {canManage ? (
        <Panel title="Add an endpoint" description="Verify each request with the signing secret in the signature header.">
          <form onSubmit={create} noValidate className="flex flex-col gap-4">
            <Field label="Endpoint URL" htmlFor="wh-url" error={formError}>
              <Input id="wh-url" type="url" inputMode="url" placeholder="https://example.com/hooks/postslot" value={url} onChange={(e) => setUrl(e.target.value)} aria-invalid={formError ? true : undefined} aria-describedby={formError ? "wh-url-error" : undefined} />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="title-4 pb-2 text-text">Events</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {events.map((ev) => (
                  <label key={ev} className="flex min-h-11 items-center gap-2 body-6 text-text">
                    <input type="checkbox" checked={picked.includes(ev)} onChange={() => toggleEvent(ev)} className="size-4 accent-action" />
                    <code>{ev === "*" ? "* (all events)" : ev}</code>
                  </label>
                ))}
              </div>
            </fieldset>
            <div><Button type="submit" loading={creating}>Add endpoint</Button></div>
          </form>
        </Panel>
      ) : null}

      <section aria-labelledby="eps-h" className="flex flex-col gap-3">
        <h2 id="eps-h" className="title-2 text-text">Endpoints</h2>
        {endpoints.loading ? <Skeleton className="h-24 w-full" /> : endpoints.error ? (
          <ErrorState title="Endpoints did not load" body={endpoints.error} action={<Button onClick={endpoints.reload}>Try again</Button>} />
        ) : (endpoints.data ?? []).length === 0 ? (
          <EmptyState title="No endpoints yet" body="Add an HTTPS URL above, then use Send test to see a signed request arrive before you rely on it." />
        ) : (
          <DataTable
            caption="Webhook endpoints"
            columns={[
              { key: "url", label: "URL" },
              { key: "events", label: "Events" },
              { key: "status", label: "Status" },
              { key: "created", label: "Added" },
              { key: "a", label: "Actions", align: "right" },
            ]}
          >
            {(endpoints.data ?? []).map((ep) => (
              <tr key={ep.id}>
                <Td className="max-w-xs break-all">{ep.url}</Td>
                <Td muted>{ep.events.join(", ")}</Td>
                <Td><Badge tone={ep.enabled ? "success" : "info"}>{ep.enabled ? "Enabled" : "Paused"}</Badge></Td>
                <Td muted>{formatDate(ep.createdAt)}</Td>
                <Td align="right">
                  {canManage ? (
                    <div className="flex justify-end gap-1">
                      <Button variant="tertiary" size="sm" onClick={() => test(ep)} loading={busy === `t${ep.id}`}>Send test</Button>
                      <Button variant="tertiary" size="sm" onClick={() => toggle(ep)} loading={busy === ep.id} aria-pressed={ep.enabled}>{ep.enabled ? "Pause" : "Resume"}</Button>
                      <Button variant="tertiary" size="sm" onClick={() => setRemoving(ep)}>Delete</Button>
                    </div>
                  ) : null}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section aria-labelledby="dl-h" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="dl-h" className="title-2 text-text">Delivery log</h2>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="dl-filter" className="caption-4 text-text-muted">Endpoint</label>
              <Select id="dl-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">All endpoints</option>
                {(endpoints.data ?? []).map((ep) => <option key={ep.id} value={ep.id}>{ep.url}</option>)}
              </Select>
            </div>
            <Button variant="secondary" onClick={deliveries.reload}>Refresh</Button>
          </div>
        </div>
        {deliveries.loading ? <Skeleton className="h-24 w-full" /> : deliveries.error ? (
          <ErrorState title="The delivery log did not load" body={deliveries.error} action={<Button onClick={deliveries.reload}>Try again</Button>} />
        ) : (deliveries.data ?? []).length === 0 ? (
          <EmptyState title="Nothing delivered yet" body="Deliveries appear here with their status, attempts and the next retry time. Send a test from an endpoint to see the first one." />
        ) : (
          <DataTable
            maxHeight
            caption="Webhook deliveries"
            columns={[
              { key: "event", label: "Event" },
              { key: "status", label: "Status" },
              { key: "attempts", label: "Attempts", align: "right" },
              { key: "code", label: "Last code", align: "right" },
              { key: "when", label: "Created" },
              { key: "next", label: "Next retry" },
            ]}
          >
            {(deliveries.data ?? []).map((d) => (
              <tr key={d.id}>
                <Td><code>{d.event}</code></Td>
                <Td>
                  <Badge tone={TONE[d.status] ?? "info"}>{d.status}</Badge>
                  {d.lastError ? <p className="caption-5 text-text-muted">{d.lastError}</p> : null}
                </Td>
                <Td align="right">{d.attempts}</Td>
                <Td align="right">{d.lastStatusCode ?? "None"}</Td>
                <Td muted>{formatDate(d.createdAt, true)}</Td>
                <Td muted>{d.nextAttemptAt ? formatDate(d.nextAttemptAt, true) : "None"}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <ConfirmDialog
        open={!!removing}
        title="Delete this endpoint"
        confirmLabel="Delete endpoint"
        busy={busy === removing?.id}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      >
        We stop sending events to {removing?.url}. Its delivery history is kept until it expires.
      </ConfirmDialog>
    </div>
  );
}
