import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AcceptInvite } from "./accept-invite";

export const metadata = { title: "Join organization" };

export default async function AcceptInvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/accept-invite/${id}`)}`);
  return <AcceptInvite id={id} email={session.user.email} />;
}
