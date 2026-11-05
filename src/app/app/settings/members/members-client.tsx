"use client";
import { useState } from "react";
import { authError, formatDate, useAsync } from "@/components/app/api";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable, Td } from "@/components/app/data-table";
import { Panel } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { authClient } from "@/lib/auth/client";

interface Member { id: string; userId: string; role: string; createdAt: string | Date; user: { name?: string | null; email: string } }
interface Invite { id: string; email: string; role: string; status: string; expiresAt: string | Date }
interface Full { members: Member[]; invitations: Invite[] }

const ROLES = ["admin", "member", "viewer"] as const;
const roleLabel = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

export function MembersClient({ orgId, meId, canInvite, canCancelInvite, canUpdate, canRemove }: {
  orgId: string; meId: string; canInvite: boolean; canCancelInvite: boolean; canUpdate: boolean; canRemove: boolean;
}) {
  const org = useAsync<Full>(async () => {
    const { data, error } = await authClient.organization.getFullOrganization({ query: { organizationId: orgId } });
    if (error || !data) throw new Error("Could not load members.");
    const d = data as unknown as Partial<Full>;
    return { members: d.members ?? [], invitations: d.invitations ?? [] };
  }, [orgId]);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("member");
  const [inviting, setInviting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setFormError("Enter a valid email address, like name@company.com.");
    setInviting(true);
    setFormError(null);
    setNotice(null);
    const { error } = await authClient.organization.inviteMember({ email: value, role, organizationId: orgId });
    setInviting(false);
    if (error) return setFormError(authError(error, "We could not send the invitation. Try again."));
    setEmail("");
    setNotice({ ok: true, text: `Invitation sent to ${value}. It expires in 7 days.` });
    org.reload();
  }

  async function changeRole(m: Member, next: string) {
    setBusy(m.id);
    setNotice(null);
    const { error } = await authClient.organization.updateMemberRole({ memberId: m.id, role: next as "admin", organizationId: orgId });
    setBusy(null);
    if (error) return setNotice({ ok: false, text: authError(error, "We could not change that role.") ?? "" });
    setNotice({ ok: true, text: `${m.user.name || m.user.email} is now ${roleLabel(next)}.` });
    org.reload();
  }

  async function remove() {
    if (!removing) return;
    setBusy(removing.id);
    const { error } = await authClient.organization.removeMember({ memberIdOrEmail: removing.id, organizationId: orgId });
    setBusy(null);
    const who = removing.user.name || removing.user.email;
    setRemoving(null);
    if (error) return setNotice({ ok: false, text: authError(error, "We could not remove that member.") ?? "" });
    setNotice({ ok: true, text: `${who} was removed from the organization.` });
    org.reload();
  }

  async function cancel(i: Invite) {
    setBusy(i.id);
    const { error } = await authClient.organization.cancelInvitation({ invitationId: i.id });
    setBusy(null);
    if (error) return setNotice({ ok: false, text: authError(error, "We could not cancel that invitation.") ?? "" });
    setNotice({ ok: true, text: `Invitation to ${i.email} canceled.` });
    org.reload();
  }

  const pending = (org.data?.invitations ?? []).filter((i) => i.status === "pending");

  return (
    <div className="flex flex-col gap-6">
      {notice ? <p role={notice.ok ? "status" : "alert"} className={notice.ok ? "caption-2 text-success" : "caption-2 text-danger"}>{notice.text}</p> : null}

      {canInvite ? (
        <Panel title="Invite a teammate" description="They get an email with a link that works for 7 days.">
          <form onSubmit={invite} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <Field label="Email" htmlFor="invite-email" error={formError}>
                <Input id="invite-email" type="email" autoComplete="off" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={formError ? true : undefined} aria-describedby={formError ? "invite-email-error" : undefined} />
              </Field>
            </div>
            <div className="sm:w-1/4">
              <Field label="Role" htmlFor="invite-role">
                <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}>
                  {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </Select>
              </Field>
            </div>
            <div className="sm:pt-6">
              <Button type="submit" loading={inviting}>Send invitation</Button>
            </div>
          </form>
        </Panel>
      ) : null}

      <section aria-labelledby="members-h" className="flex flex-col gap-3">
        <h2 id="members-h" className="title-2 text-text">Members</h2>
        {org.loading ? <Skeleton className="h-24 w-full" /> : org.error ? (
          <ErrorState title="Members did not load" body={org.error} action={<Button onClick={org.reload}>Try again</Button>} />
        ) : (
          <DataTable
            caption="Organization members"
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "role", label: "Role" },
              { key: "joined", label: "Joined" },
              { key: "a", label: "Actions", align: "right" },
            ]}
          >
            {(org.data?.members ?? []).map((m) => {
              const isMe = m.userId === meId;
              const isOwner = m.role.split(",").includes("owner");
              const editable = canUpdate && !isMe && !isOwner;
              return (
                <tr key={m.id}>
                  <Td>{m.user.name || "No name"} {isMe ? <Badge>You</Badge> : null}</Td>
                  <Td muted>{m.user.email}</Td>
                  <Td>
                    {editable ? (
                      <Select aria-label={`Role for ${m.user.email}`} value={m.role} disabled={busy === m.id} onChange={(e) => changeRole(m, e.target.value)} className="min-w-24">
                        {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                      </Select>
                    ) : (
                      roleLabel(m.role)
                    )}
                  </Td>
                  <Td muted>{formatDate(m.createdAt)}</Td>
                  <Td align="right">
                    {canRemove && !isMe && !isOwner ? <Button variant="tertiary" size="sm" onClick={() => setRemoving(m)}>Remove</Button> : null}
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </section>

      <section aria-labelledby="invites-h" className="flex flex-col gap-3">
        <h2 id="invites-h" className="title-2 text-text">Pending invitations</h2>
        {org.loading ? null : pending.length === 0 ? (
          <EmptyState title="No pending invitations" body={canInvite ? "Invite a teammate above and they will show up here until they accept." : "Owners and admins can invite teammates."} />
        ) : (
          <DataTable
            caption="Pending invitations"
            columns={[
              { key: "email", label: "Email" },
              { key: "role", label: "Role" },
              { key: "exp", label: "Expires" },
              { key: "a", label: "Actions", align: "right" },
            ]}
          >
            {pending.map((i) => (
              <tr key={i.id}>
                <Td>{i.email}</Td>
                <Td>{roleLabel(i.role)}</Td>
                <Td muted>{formatDate(i.expiresAt)}</Td>
                <Td align="right">
                  {canCancelInvite ? <Button variant="tertiary" size="sm" onClick={() => cancel(i)} loading={busy === i.id}>Cancel</Button> : null}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.user.name || removing?.user.email || "member"}`}
        confirmLabel="Remove member"
        busy={busy === removing?.id}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      >
        They lose access to this organization immediately. Their account and other organizations are not affected.
      </ConfirmDialog>
    </div>
  );
}
