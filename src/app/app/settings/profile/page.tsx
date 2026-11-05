import { PageHeader } from "@/components/app/page-header";
import { requireOrg } from "@/lib/auth/session";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const ctx = await requireOrg({ page: true });
  return (
    <>
      <PageHeader title="Profile" description="Your name and personal data. These settings apply to you, not to the organization." />
      <ProfileClient name={ctx.user.name} email={ctx.user.email} verified={ctx.user.emailVerified} />
    </>
  );
}
