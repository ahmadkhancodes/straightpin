"use client";
import { Fingerprint } from "@phosphor-icons/react";
import { useState } from "react";
import { authError } from "@/components/app/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { authClient } from "@/lib/auth/client";

type Phase = "idle" | "sending" | "sent";

export function SignInForm({ callbackURL, expiredLink }: { callbackURL: string; expiredLink?: boolean }) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address, like name@company.com.");
      return;
    }
    setError(null);
    setPhase("sending");
    const { error: err } = await authClient.signIn.magicLink({
      email: value,
      callbackURL,
      newUserCallbackURL: `/onboarding?next=${encodeURIComponent(callbackURL)}`,
      errorCallbackURL: "/sign-in",
    });
    if (err) {
      setPhase("idle");
      setError(authError(err, "We could not send the link. Check the address and try again."));
      return;
    }
    setPhase("sent");
  }

  async function passkey() {
    setPasskeyBusy(true);
    setError(null);
    const res = await authClient.signIn.passkey();
    if (res?.error) {
      setPasskeyBusy(false);
      setError(authError(res.error, "Passkey sign-in did not complete. Use the email link instead."));
      return;
    }
    window.location.assign(callbackURL);
  }

  if (phase === "sent") {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="success" title={`Check your inbox at ${email.trim()}`}>
          The link works for 10 minutes and only once. If nothing arrives, look in spam, then send it again.
        </Notice>
        <div>
          <Button variant="tertiary" onClick={() => setPhase("idle")}>Use a different email</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {expiredLink ? <Notice tone="warning" title="That link has expired">Links work once for 10 minutes. Request a new one below.</Notice> : null}
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email" error={error}>
          <Input
            id="email" name="email" type="email" autoComplete="email webauthn" inputMode="email" required
            placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined} aria-describedby={error ? "email-error" : undefined}
          />
        </Field>
        <Button type="submit" loading={phase === "sending"}>{phase === "sending" ? "Sending link" : "Email me a sign-in link"}</Button>
      </form>
      <div className="flex items-center gap-3" aria-hidden>
        <div className="h-px flex-1 bg-border" />
        <span className="caption-4 text-text-muted">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="secondary" onClick={passkey} loading={passkeyBusy}>
        <Fingerprint size={20} weight="regular" aria-hidden />
        Sign in with a passkey
      </Button>
    </div>
  );
}
