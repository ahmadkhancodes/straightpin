"use client";
import { useState } from "react";
import { authError } from "@/components/app/api";
import { safeNext } from "@/components/app/redirect";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";

export function TwoFactorForm() {
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim();
    if (!value) {
      setError(backup ? "Enter one of your backup codes." : "Enter the 6 digit code from your app.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = backup ? await authClient.twoFactor.verifyBackupCode({ code: value }) : await authClient.twoFactor.verifyTotp({ code: value });
    if (res.error) {
      setBusy(false);
      setError(authError(res.error, "That code did not match. Check the time on your phone and try again."));
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.assign(safeNext(next));
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label={backup ? "Backup code" : "6 digit code"} htmlFor="code" error={error} hint={backup ? "Each backup code works once." : undefined}>
        <Input
          id="code" name="code" autoComplete="one-time-code" inputMode={backup ? "text" : "numeric"} required
          value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={error ? true : undefined}
          aria-describedby={error ? "code-error" : undefined} className="tabular-nums"
        />
      </Field>
      <Button type="submit" loading={busy}>Verify and continue</Button>
      <div>
        <Button type="button" variant="tertiary" onClick={() => { setBackup((b) => !b); setCode(""); setError(null); }}>
          {backup ? "Use my authenticator app" : "Use a backup code"}
        </Button>
      </div>
    </form>
  );
}
