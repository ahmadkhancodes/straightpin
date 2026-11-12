import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { product } from "@/config/product";

/** Two columns on desktop: the form on newsprint, and our promises printed on an ink column (no art, no stock). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-12">
      <div className="flex min-h-dvh flex-col lg:col-span-7">
        <header className="flex items-center justify-between border-b-2 border-rule px-4 py-2 sm:px-6 lg:px-10">
          <Link href="/" className="heading-5 inline-flex min-h-11 items-center text-text focus-visible:focus-ring">
            <span aria-hidden className="mr-2 inline-block size-3 bg-highlight outline outline-1 outline-rule" />
            {product.name}
          </Link>
        </header>
        <main id="main" className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-md flex-col gap-8">{children}</div>
        </main>
        <footer className="px-4 py-6 sm:px-6 lg:px-10">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 body-6 text-text-subtle transition-colors duration-300 hover:text-text focus-visible:focus-ring">
            <ArrowLeft size={16} weight="bold" aria-hidden />
            Back to {product.name}
          </Link>
        </footer>
      </div>
      <aside aria-label="What you are signing up for" className="hidden bg-surface-inverse px-10 py-16 text-text-inverse lg:col-span-5 lg:flex lg:flex-col lg:justify-center">
        <p className="kicker border-t-2 border-current pt-3">Our side of the deal</p>
        <p className="heading-3 mt-8 max-w-md">Every job from the company&apos;s own page, with its real first posted date.</p>
        <dl className="body-6 mt-10 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-t border-text-inverse pt-6">
          <dt className="kicker pt-0.5">Free</dt><dd>{product.plans[0]!.limits.opens} job opens a day, no card</dd>
          <dt className="kicker pt-0.5">Refund</dt><dd>{product.refundDays} days from your first payment</dd>
          <dt className="kicker pt-0.5">Cancel</dt><dd>two taps, from Billing</dd>
          <dt className="kicker pt-0.5">Never</dt><dd>a cut of your pay, or applying for you</dd>
        </dl>
      </aside>
    </div>
  );
}
