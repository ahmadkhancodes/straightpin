import { redirect } from "next/navigation";
import { safeNext } from "@/components/app/redirect";
import { getOrgContext, getSession } from "@/lib/auth/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Create your organization" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OnboardingPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = safeNext(one(sp.next));
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(next)}`)}`);
  // One organization per person (D-057): anyone who already has one goes straight on.
  if (await getOrgContext()) redirect(next);
  // Job seekers get their personal account set up for them; the form below is only the fallback if that fails.
  if (one(sp.manual) !== "1") redirect(`/onboarding/start?next=${encodeURIComponent(next)}`);
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="heading-5 text-text">Name your account</h1>
        <p className="body-6 text-text-subtle">
          We could not set up your account by ourselves. Give it a name, such as your own, and you are in. It holds your plan and saved jobs.
        </p>
      </div>
      <OnboardingForm next={next} />
    </>
  );
}
