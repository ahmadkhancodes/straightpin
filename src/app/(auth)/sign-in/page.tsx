import { redirect } from "next/navigation";
import { afterSignIn } from "@/components/app/redirect";
import { product } from "@/config/product";
import { getSession } from "@/lib/auth/session";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SignInPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const callbackURL = afterSignIn({ next: one(sp.next), plan: one(sp.plan), interval: one(sp.interval) });
  if (await getSession()) redirect(callbackURL);
  const link = one(sp.error) === "invalid_token" || one(sp.error) === "INVALID_TOKEN" || one(sp.error) === "EXPIRED_TOKEN";
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="heading-5 text-text">Sign in to {product.name}</h1>
        <p className="body-6 text-text-subtle">We email you a link, so there is no password to remember. New here? The same link creates your account.</p>
      </div>
      <SignInForm callbackURL={callbackURL} expiredLink={link} />
    </>
  );
}
