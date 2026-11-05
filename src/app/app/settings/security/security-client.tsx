"use client";
import { Fingerprint, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { authError, formatDate, useAsync } from "@/components/app/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { CopyButton } from "@/components/app/copy-button";
import { DataTable, Td } from "@/components/app/data-table";
import { Panel } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge, EmptyState, ErrorState, Notice, Skeleton } from "@/components/ui/states";
import { authClient } from "@/lib/auth/client";

interface PasskeyRow { id: string; name?: string | null; createdAt?: string | Date | null; deviceType?: string | null }
interface SessionRow { id: string; token: string; userAgent?: string | null; ipAddress?: string | null; createdAt: string | Date }

function describeAgent(ua?: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

function Passkeys() {
  const list = useAsync<PasskeyRow[]>(async () => {
    const { data, error } = await authClient.passkey.listUserPasskeys();
    if (error) throw new Error("Could not load your passkeys.");
    return (data ?? []) as PasskeyRow[];
  });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PasskeyRow | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const label = name.trim() || undefined;
    const res = await authClient.passkey.addPasskey({ name: label });
    setBusy(false);
    if (res?.error) return setError(authError(res.error, "The passkey was not added. Your device may have canceled the request."));
    setName("");
    setOk(`Passkey ${label ?? ""} added. You can use it to sign in next time.`.replace("  ", " "));
    list.reload();
  }

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    const { error: err } = await authClient.passkey.deletePasskey({ id: removing.id });
    setRemoveBusy(false);
    if (err) return setError(authError(err, "We could not remove that passkey."));
    setRemoving(null);
    list.reload();
  }

  return (
    <Panel title="Passkeys" description="Sign in with your fingerprint, face or a security key instead of waiting for an email.">
      <div className="flex flex-col gap-4">
        {list.loading ? <Skeleton className="h-16 w-full" /> : list.error ? (
          <ErrorState title="Passkeys did not load" body={list.error} action={<Button onClick={list.reload}>Try again</Button>} />
        ) : list.data && list.data.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {list.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Fingerprint size={20} weight="regular" aria-hidden className="shrink-0 text-text-subtle" />
                  <div className="min-w-0">
                    <p className="title-4 truncate text-text">{p.name || "Unnamed passkey"}</p>
                    <p className="caption-5 text-text-muted">Added {formatDate(p.createdAt)}</p>
                  </div>
                </div>
                <Button variant="tertiary" size="sm" aria-label={`Remove passkey ${p.name ?? ""}`} onClick={() => setRemoving(p)}>
                  <Trash size={16} weight="regular" aria-hidden />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No passkeys yet" body="Add one on this device and sign in with a touch or a glance next time. Keep the email link as your fallback." />
        )}
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Passkey name" htmlFor="passkey-name" error={error} hint="Optional, for example Work laptop.">
              <Input id="passkey-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-describedby={error ? "passkey-name-error" : undefined} aria-invalid={error ? true : undefined} />
            </Field>
          </div>
          <Button type="submit" loading={busy}>Add a passkey</Button>
        </form>
        {ok ? <p role="status" className="caption-2 text-success">{ok}</p> : null}
      </div>
      <ConfirmDialog
        open={!!removing}
        title="Remove this passkey"
        confirmLabel="Remove passkey"
        busy={removeBusy}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      >
        You will no longer be able to sign in with {removing?.name || "this passkey"}. Other sign-in methods keep working.
      </ConfirmDialog>
    </Panel>
  );
}

type EnableFn = (b: Record<string, unknown>) => Promise<{ data: { totpURI: string; backupCodes: string[] } | null; error: { message?: string; status?: number } | null }>;
type DisableFn = (b: Record<string, unknown>) => Promise<{ error: { message?: string; status?: number } | null }>;

function TwoFactor({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [setup, setSetup] = useState<{ uri: string; secret: string; codes: string[] } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await (authClient.twoFactor.enable as unknown as EnableFn)({});
    setBusy(false);
    if (err || !data) return setError(authError(err, "We could not start setup. Try again."));
    let secret = "";
    try { secret = new URL(data.totpURI).searchParams.get("secret") ?? ""; } catch { secret = ""; }
    setSetup({ uri: data.totpURI, secret, codes: data.backupCodes });
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!setup) return;
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6 digit code shown in your authenticator app.");
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    setBusy(false);
    if (err) return setError(authError(err, "That code did not match. Check the time on your phone and try again."));
    setCodes(setup.codes);
    setSetup(null);
    setCode("");
    setEnabled(true);
  }

  async function disable() {
    setBusy(true);
    const { error: err } = await (authClient.twoFactor.disable as unknown as DisableFn)({});
    setBusy(false);
    if (err) {
      setConfirmOff(false);
      return setError(authError(err, "We could not turn it off. Try again."));
    }
    setConfirmOff(false);
    setEnabled(false);
    setCodes(null);
  }

  return (
    <Panel
      title="Authenticator app"
      description="Ask for a 6 digit code from an app like 1Password, Authy or Google Authenticator after you sign in."
      actions={<Badge tone={enabled ? "success" : "info"}>{enabled ? "On" : "Off"}</Badge>}
    >
      <div className="flex flex-col gap-4">
        {codes ? (
          <div role="status" className="flex flex-col gap-3 rounded-lg border border-success bg-success-surface p-4">
            <p className="title-4 text-text">Two-factor is on. Save your backup codes.</p>
            <p className="body-6 text-text-subtle">Each code works once if you lose your phone. We show them only now.</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {codes.map((c) => <li key={c}><code className="caption-2 text-text">{c}</code></li>)}
            </ul>
            <div className="flex gap-2">
              <CopyButton value={codes.join("\n")} label="Copy all codes" />
              <Button variant="tertiary" size="sm" onClick={() => setCodes(null)}>I have saved them</Button>
            </div>
          </div>
        ) : null}

        {setup ? (
          <form onSubmit={verify} className="flex flex-col gap-4">
            <ol className="flex list-decimal flex-col gap-3 pl-6 body-6 text-text-subtle">
              <li>Open your authenticator app and choose to add an account by URI or setup key.</li>
              <li>
                Paste this URI, or type the setup key by hand.
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-surface-raised px-3 py-2 caption-2 text-text">{setup.uri}</code>
                    <CopyButton value={setup.uri} label="Copy URI" />
                  </div>
                  {setup.secret ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-surface-raised px-3 py-2 caption-2 text-text">{setup.secret}</code>
                      <CopyButton value={setup.secret} label="Copy key" />
                    </div>
                  ) : null}
                </div>
              </li>
              <li>Enter the 6 digit code the app shows to finish.</li>
            </ol>
            <div className="max-w-xs">
              <Field label="6 digit code" htmlFor="totp-code" error={error}>
                <Input id="totp-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className="tabular-nums" aria-invalid={error ? true : undefined} aria-describedby={error ? "totp-code-error" : undefined} />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>Verify and turn on</Button>
              <Button type="button" variant="tertiary" onClick={() => { setSetup(null); setError(null); }}>Cancel</Button>
            </div>
          </form>
        ) : enabled ? (
          <div><Button variant="secondary" onClick={() => setConfirmOff(true)}>Turn off two-factor</Button></div>
        ) : (
          <div><Button onClick={start} loading={busy}>Set up authenticator app</Button></div>
        )}
        {!setup && error ? <p role="alert" className="caption-2 text-danger">{error}</p> : null}
      </div>
      <ConfirmDialog open={confirmOff} title="Turn off two-factor" confirmLabel="Turn off" busy={busy} onConfirm={disable} onClose={() => setConfirmOff(false)}>
        Your account will be protected by your sign-in link or passkey only.
      </ConfirmDialog>
    </Panel>
  );
}

function Sessions({ currentSessionId }: { currentSessionId: string }) {
  const list = useAsync<SessionRow[]>(async () => {
    const { data, error } = await authClient.listSessions();
    if (error) throw new Error("Could not load your sessions.");
    return (data ?? []) as unknown as SessionRow[];
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function revoke(s: SessionRow) {
    setBusy(s.id);
    const { error } = await authClient.revokeSession({ token: s.token });
    setBusy(null);
    if (error) return setMsg({ ok: false, text: authError(error, "We could not sign that device out.") ?? "" });
    setMsg({ ok: true, text: `Signed out ${describeAgent(s.userAgent)}.` });
    list.reload();
  }
  async function revokeOthers() {
    setBusy("others");
    const { error } = await authClient.revokeOtherSessions();
    setBusy(null);
    if (error) return setMsg({ ok: false, text: authError(error, "We could not sign the other devices out.") ?? "" });
    setMsg({ ok: true, text: "Every other device is signed out." });
    list.reload();
  }

  const others = (list.data ?? []).filter((s) => s.id !== currentSessionId).length;
  return (
    <Panel
      title="Active sessions"
      description="Devices currently signed in to your account."
      actions={<Button variant="secondary" size="sm" onClick={revokeOthers} loading={busy === "others"} disabled={others === 0}>Sign out other sessions</Button>}
    >
      <div className="flex flex-col gap-4">
        {msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "caption-2 text-success" : "caption-2 text-danger"}>{msg.text}</p> : null}
        {list.loading ? <Skeleton className="h-24 w-full" /> : list.error ? (
          <ErrorState title="Sessions did not load" body={list.error} action={<Button onClick={list.reload}>Try again</Button>} />
        ) : (
          <DataTable
            caption="Active sessions"
            columns={[
              { key: "device", label: "Device" },
              { key: "ip", label: "IP address" },
              { key: "since", label: "Signed in" },
              { key: "a", label: "Action", align: "right" },
            ]}
          >
            {(list.data ?? []).map((s) => (
              <tr key={s.id}>
                <Td>
                  {describeAgent(s.userAgent)} {s.id === currentSessionId ? <Badge tone="success">This device</Badge> : null}
                </Td>
                <Td muted>{s.ipAddress || "Unknown"}</Td>
                <Td muted>{formatDate(s.createdAt, true)}</Td>
                <Td align="right">
                  {s.id === currentSessionId ? null : (
                    <Button variant="tertiary" size="sm" onClick={() => revoke(s)} loading={busy === s.id}>Sign out</Button>
                  )}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
        <Notice>Do not recognize a device? Sign it out, then turn on an authenticator app above.</Notice>
      </div>
    </Panel>
  );
}

export function SecurityClient({ twoFactorEnabled, currentSessionId }: { twoFactorEnabled: boolean; currentSessionId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <Passkeys />
      <TwoFactor initiallyEnabled={twoFactorEnabled} />
      <Sessions currentSessionId={currentSessionId} />
    </div>
  );
}
