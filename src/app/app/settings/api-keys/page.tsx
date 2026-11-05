import { PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/auth/roles";
import { requireOrg } from "@/lib/auth/session";
import { ApiKeysClient } from "./api-keys-client";

export const metadata = { title: "API keys" };

export default async function ApiKeysPage() {
  const ctx = await requireOrg({ page: true });
  return (
    <>
      <PageHeader title="API keys" description={`Keys for ${ctx.org.name}. Send one in the x-api-key header from your server. Never put a key in browser code.`} />
      <ApiKeysClient orgId={ctx.org.id} canManage={can(ctx.role, "apiKey", "manage")} />
    </>
  );
}
