"use client";
import { DownloadSimple } from "@phosphor-icons/react";
import { useState } from "react";
import { api, authError , hardNavigate } from "@/components/app/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Panel } from "@/components/app/page-header";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/states";
import { authClient } from "@/lib/auth/client";

export function ProfileClient({ name: initial, email, verified }: { name: string; email: string; verified: boolean }) {
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [del, setDel] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return setMsg({ ok: false, text: "Enter the name your teammates will see." });
    setBusy(true);
    setMsg(null);
    const { error } = await authClient.updateUser({ name: clean });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: authError(error, "We could not save your name. Try again.") ?? "" });
    setSaved(clean);
    setMsg({ ok: true, text: `Name updated to ${clean}.` });
  }

  async function remove() {
    setDelBusy(true);
    setDelError(null);
    const r = await api<{ deleted: boolean }>("/api/account", { method: "DELETE", body: { confirm: "delete my account" } });
    if (!r.ok) {
      setDelBusy(false);
      setDelError(r.message);
      return;
    }
    hardNavigate("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Your details">
        <form onSubmit={save} noValidate className="flex max-w-md flex-col gap-4">
          <Field label="Name" htmlFor="name" error={msg && !msg.ok ? msg.text : null}>
            <Input id="name" name="name" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={msg && !msg.ok ? true : undefined} aria-describedby={msg && !msg.ok ? "name-error" : undefined} />
          </Field>
          <Field label="Email" htmlFor="email" hint="Your email is how you sign in, so it cannot be changed here. Contact support to move to a new address.">
            <Input id="email" value={email} readOnly aria-readonly />
          </Field>
          <div className="flex items-center gap-2">
            <Badge tone={verified ? "success" : "warning"}>{verified ? "Email verified" : "Email not verified"}</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Button type="submit" loading={busy} disabled={name.trim() === saved}>Save changes</Button>
            {msg?.ok ? <p role="status" className="caption-2 text-success">{msg.text}</p> : null}
          </div>
        </form>
      </Panel>

      <Panel title="Export your data" description="A JSON file with your account and organization data. It is generated when you click, and nothing is emailed.">
        <a href="/api/account/export" download className={buttonClass("secondary")}>
          <DownloadSimple size={20} weight="regular" aria-hidden />
          Download my data
        </a>
      </Panel>

      <section aria-labelledby="danger-h" className="flex flex-col gap-4 rounded-lg border border-danger p-6">
        <div className="flex flex-col gap-1">
          <h2 id="danger-h" className="title-2 text-danger">Delete account</h2>
          <p className="body-6 text-text-subtle">
            This removes your sign-in, your sessions and the organizations you own, and cancels their subscriptions. It cannot be undone. Download your data first.
          </p>
        </div>
        <div>
          <Button variant="danger" onClick={() => setDel(true)}>Delete my account</Button>
        </div>
      </section>

      <ConfirmDialog
        open={del}
        title="Delete your account"
        confirmLabel="Delete account permanently"
        typeToConfirm="delete my account"
        busy={delBusy}
        error={delError}
        onConfirm={remove}
        onClose={() => { setDel(false); setDelError(null); }}
      >
        Everything tied to {email} will be erased and active subscriptions will be canceled.
      </ConfirmDialog>
    </div>
  );
}
