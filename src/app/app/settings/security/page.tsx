import { PageHeader } from "@/components/app/page-header";
import { requireOrg } from "@/lib/auth/session";
import { SecurityClient } from "./security-client";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const ctx = await requireOrg({ page: true });
  return (
    <>
      <PageHeader title="Security" description="Passkeys, an authenticator app and the devices signed in to your account." />
      <SecurityClient twoFactorEnabled={!!ctx.user.twoFactorEnabled} currentSessionId={ctx.sessionId} />
    </>
  );
}
