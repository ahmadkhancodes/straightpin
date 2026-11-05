"use client";
import { useState } from "react";
import { authError, useAsync , hardNavigate } from "@/components/app/api";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { authClient } from "@/lib/auth/client";

interface Invitation { id: string; organizationId: string; organizationName?: string; role: string; email: string; inviterEmail?: string; status: string }

export function AcceptInvite({ id, email }: { id: string; email: string }) {
  const inv = useAsync<Invitation>(async () => {
    const { data, error } = await authClient.organization.getInvitation({ query: { id } });
    if (error || !data) throw new Error("This invitation is invalid, expired or was sent to a different email address.");
    return data as unknown as Invitation;
  }, [id]);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (inv.loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }
  if (inv.error || !inv.data) {
    return (
      <ErrorState
        title="We cannot open this invitation"
        body={<>{inv.error ?? "It may have expired."} You are signed in as {email}. Ask the person who invited you to send a new one to that address.</>}
      />
    );
  }
  const i = inv.data;
  const name = i.organizationName ?? "this organization";

  async function accept() {
    setBusy("accept");
    setError(null);
    const { error: err } = await authClient.organization.acceptInvitation({ invitationId: id });
    if (err) {
      setBusy(null);
      setError(authError(err, "We could not accept the invitation. Try again."));
      return;
    }
    await authClient.organization.setActive({ organizationId: i.organizationId });
    hardNavigate("/app");
  }

  async function decline() {
    setBusy("decline");
    setError(null);
    const { error: err } = await authClient.organization.rejectInvitation({ invitationId: id });
    if (err) {
      setBusy(null);
      setError(authError(err, "We could not decline the invitation. Try again."));
      return;
    }
    hardNavigate("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="heading-5 text-text">Join {name}</h1>
        <p className="body-6 text-text-subtle">
          You were invited as {i.role}. You are signed in as {email}.
        </p>
      </div>
      {error ? <p role="alert" className="caption-2 text-danger">{error}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={accept} loading={busy === "accept"} disabled={busy !== null}>Accept invitation</Button>
        <Button variant="secondary" onClick={decline} loading={busy === "decline"} disabled={busy !== null}>Decline</Button>
      </div>
    </div>
  );
}
