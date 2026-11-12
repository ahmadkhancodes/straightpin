import type { Metadata } from "next";
import { Section } from "@/components/ui/layout";
import { PricingTable } from "@/components/marketing/pricing-table";
import { Faq } from "@/components/marketing/faq";
import { socialImages } from "@/lib/seo";
import { product } from "@/config/product";

const title = "Pricing";
const description = `What we charge, full stop. Free to start, $10.99 a month, $4.99 a week, or $23.99 once. Cancel in two taps, ${product.refundDays} day refund.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title: `${title} · ${product.fullName}`, description, url: "/pricing", ...socialImages().openGraph },
  twitter: { title: `${title} · ${product.fullName}`, ...socialImages().twitter },
};

const billingFaq = [
  { q: "How do I cancel?", a: "Two taps from your account: open Billing, then Cancel plan. You keep your plan until the end of the period you paid for." },
  { q: "What if I forget to cancel?", a: "We email you a renewal reminder before every renewal, with the date and the amount. If you are charged and did not mean to be, ask within 7 days and you get a full refund." },
  { q: "How do I get a refund?", a: "Within 7 days of any payment, email support and say you want it. No questions, full refund." },
  { q: "Do I need a card for the Free plan?", a: "No. Free has 5 job opens a day, 10 saved jobs and a daily email digest." },
  { q: "What does Lifetime include?", a: "The core plan for as long as the service runs, without the Plus features. It is limited to the first 1,000 buyers, then reviewed." },
  { q: "Which currency?", a: "US dollars for now. Canada and the UK get local prices at checkout later." },
];

export default function PricingPage() {
  return (
    <>
      <Section labelledBy="pricing-title" space="sm" head="Prices">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <h1 id="pricing-title" className="heading-3 md:heading-1 max-w-3xl text-text">What we charge, full stop.</h1>
            <p className="body-3 md:title-1 mt-4 max-w-2xl text-text-subtle">The price is on this page before you sign up. Monthly is pre selected. Nothing is crossed out.</p>
          </div>
          <dl className="body-6 figures grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border border-rule bg-surface-raised p-4 text-text lg:col-span-4" aria-label="Our billing promises">
            <dt className="text-text-subtle">Price</dt><dd>shown before sign up</dd>
            <dt className="text-text-subtle">Cancel</dt><dd>two taps, from Billing</dd>
            <dt className="text-text-subtle">Refund</dt><dd>{product.refundDays} days from first payment</dd>
            <dt className="text-text-subtle">Reminder</dt><dd>email before every renewal</dd>
          </dl>
        </div>
        <div className="mt-12"><PricingTable /></div>
      </Section>
      <Faq title="Billing questions" items={billingFaq} head="Billing" />
    </>
  );
}
