import { PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/auth/roles";
import { requireOrg } from "@/lib/auth/session";
import { MembersClient } from "./members-client";

export const metadata = { title: "Members" };

export default async function MembersPage() {
  const ctx = await requireOrg({ page: true });
  return (
    <>
      <PageHeader title="Members" description={`People who can access ${ctx.org.name}, and what they can do.`} />
      <MembersClient
        orgId={ctx.org.id}
        meId={ctx.user.id}
        canInvite={can(ctx.role, "invitation", "create")}
        canCancelInvite={can(ctx.role, "invitation", "cancel")}
        canUpdate={can(ctx.role, "member", "update")}
        canRemove={can(ctx.role, "member", "delete")}
      />
    </>
  );
}
