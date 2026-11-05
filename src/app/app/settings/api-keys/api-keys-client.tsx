"use client";
import { useState } from "react";
import { authError, formatDate, useAsync } from "@/components/app/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { SecretReveal } from "@/components/app/copy-button";
import { DataTable, Td } from "@/components/app/data-table";
import { Panel } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, ErrorState, Notice, Skeleton } from "@/components/ui/states";
import { authClient } from "@/lib/auth/client";

interface KeyRow { id: string; name: string | null; start: string | null; prefix: string | null; createdAt: string | Date; lastRequest: string | Date | null }

export function ApiKeysClient({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const keys = useAsync<KeyRow[]>(async () => {
    const { data, error } = await authClient.apiKey.list({ query: { organizationId: orgId } });
    if (error || !data) throw new Error("Could not load API keys.");
    const rows = Array.isArray(data) ? data : ((data as { apiKeys?: unknown[] }).apiKeys ?? []);
    return rows as unknown as KeyRow[];
  }, [orgId]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [removing, setRemoving] = useState<KeyRow | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return setError("Name the key after where it will be used, for example Production server.");
    setBusy(true);
    setError(null);
    const { data, error: err } = await authClient.apiKey.create({ name: clean, organizationId: orgId });
    setBusy(false);
    if (err || !data) return setError(authError(err, "We could not create the key. Try again."));
    setCreated({ name: clean, key: (data as unknown as { key: string }).key });
    setName("");
    keys.reload();
  }

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(null);
    const { error: err } = await authClient.apiKey.delete({ keyId: removing.id });
    setRemoveBusy(false);
    if (err) return setRemoveError(authError(err, "We could not delete that key."));
    setRemoving(null);
    keys.reload();
  }

  return (
    <div className="flex flex-col gap-6">
      {!canManage ? <Notice title="Read only">Only owners and admins can create or delete API keys.</Notice> : null}
      {created ? <SecretReveal title={`Key created: ${created.name}`} value={created.key} onDismiss={() => setCreated(null)} /> : null}

      {canManage ? (
        <Panel title="Create a key">
          <form onSubmit={create} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <Field label="Name" htmlFor="key-name" error={error}>
                <Input id="key-name" maxLength={60} placeholder="Production server" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? "key-name-error" : undefined} />
              </Field>
            </div>
            <div className="sm:pt-6">
              <Button type="submit" loading={busy}>Create key</Button>
            </div>
          </form>
        </Panel>
      ) : null}

      <section aria-labelledby="keys-h" className="flex flex-col gap-3">
        <h2 id="keys-h" className="title-2 text-text">Your keys</h2>
        {keys.loading ? <Skeleton className="h-24 w-full" /> : keys.error ? (
          <ErrorState title="Keys did not load" body={keys.error} action={<Button onClick={keys.reload}>Try again</Button>} />
        ) : (keys.data ?? []).length === 0 ? (
          <EmptyState title="No API keys yet" body="Create a key, copy it once, and store it as an environment variable on your server. The full key is never shown again, only its first characters." />
        ) : (
          <DataTable
            caption="API keys"
            columns={[
              { key: "name", label: "Name" },
              { key: "key", label: "Key" },
              { key: "created", label: "Created" },
              { key: "used", label: "Last used" },
              { key: "a", label: "Actions", align: "right" },
            ]}
          >
            {(keys.data ?? []).map((k) => (
              <tr key={k.id}>
                <Td>{k.name || "Unnamed key"}</Td>
                <Td muted><code>{k.start ?? k.prefix ?? ""}...</code></Td>
                <Td muted>{formatDate(k.createdAt)}</Td>
                <Td muted>{formatDate(k.lastRequest)}</Td>
                <Td align="right">
                  {canManage ? <Button variant="tertiary" size="sm" onClick={() => setRemoving(k)}>Delete</Button> : null}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <ConfirmDialog
        open={!!removing}
        title={`Delete ${removing?.name || "this key"}`}
        confirmLabel="Delete key"
        busy={removeBusy}
        error={removeError}
        onConfirm={remove}
        onClose={() => { setRemoving(null); setRemoveError(null); }}
      >
        Anything using this key stops working right away. This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
