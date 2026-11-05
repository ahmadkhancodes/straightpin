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
  if (!session) redirect(`/sign-in?next=${encodeURIComponent("/onboarding")}`);
  const adding = one(sp.new) === "1";
  if (!adding && (await getOrgContext())) redirect(next);
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="heading-5 text-text">{adding ? "Create another organization" : "Name your organization"}</h1>
        <p className="body-6 text-text-subtle">
          An organization holds your members, plan and data. You can invite teammates and rename it later.
        </p>
      </div>
      <OnboardingForm next={next} />
    </>
  );
}
