import type { Metadata } from "next";
import { Section } from "@/components/ui/layout";
import { PricingTable } from "@/components/marketing/pricing-table";
import { Faq } from "@/components/marketing/faq";
import { product } from "@/config/product";

const title = "Pricing";
const description = `${product.name} plans from free to agency. Spam never counts toward your quota and over-limit submissions are held, never dropped.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title: `${title} · ${product.fullName}`, description, url: "/pricing" },
};

const billingFaq = [
  { q: "Can I cancel anytime?", a: "Yes. You can cancel a paid plan from your account whenever you like." },
  { q: "Does spam count toward my submission quota?", a: "No. Submissions blocked as spam never count toward your monthly quota on any plan." },
  { q: "What happens if I go over my limit?", a: "Submissions over the limit are held, not dropped. They wait in your inbox so you can release them once you have upgraded." },
  { q: "Do I need a credit card for the Free plan?", a: "No. Start on Free with no card and move to a paid plan when you need more." },
  { q: "Can I pay monthly instead of yearly?", a: "Pro and Agency can be billed monthly or yearly. Starter is billed yearly only." },
];

export default function PricingPage() {
  return (
    <>
      <Section labelledBy="pricing-title">
        <h1 className="sr-only">{title}</h1>
        <PricingTable title="Pricing that stays out of the way" />
      </Section>
      <Faq title="Billing questions" items={billingFaq} />
    </>
  );
}
