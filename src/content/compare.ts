import { planById, product } from "@/config/product";
import type { CompareValue } from "@/components/marketing/compare-table";

export interface CompareEntry {
  slug: string;
  competitor: string;
  title: string;
  description: string;
  headline: string;
  intro: string;
  rows: { label: string; values: [CompareValue, CompareValue] }[];
  /** Things we have not confirmed stay as {{verify}} until checked against the competitor's own pages. */
  fitNote: string;
  faq: { q: string; a: string }[];
}

const dollars = (cents: number) => `$${cents / 100}`;
const proYear = planById("pro")?.prices.find((p) => p.interval === "year")?.usd ?? 0;

/** Compare-page template data: add an entry and /compare/<slug> exists. Facts only; mark the rest {{verify}}. */
export const comparisons: CompareEntry[] = [
  {
    slug: "web3forms",
    competitor: "Web3Forms",
    title: `${product.name} vs Web3Forms`,
    description: `${product.name} and Web3Forms compared on free quota, paid price, delivery log, spam handling and what happens over the limit.`,
    headline: `${product.name} vs Web3Forms`,
    intro: `Both give a static site a form endpoint. The difference is what you can see after a visitor presses send: ${product.name} keeps a delivery receipt for every submission.`,
    rows: [
      { label: "Free plan submissions per month", values: ["250", "250"] },
      { label: "Paid plan, billed yearly", values: ["Pro, $149 a year", `Pro, ${dollars(proYear)} a year`] },
      { label: "Delivery log with a receipt per submission", values: ["{{verify}}", true] },
      { label: "Spam counts toward your quota", values: ["{{verify}}", "Never"] },
      { label: "Submissions over the limit", values: ["{{verify}}", "Held, not dropped"] },
    ],
    fitNote: "{{verify}} Where Web3Forms is the better fit.",
    faq: [
      { q: `Is ${product.name} cheaper than Web3Forms Pro?`, a: `Web3Forms Pro is $149 a year. ${product.name} Pro is ${dollars(proYear)} a year and includes a delivery log.` },
      { q: "Do both have a free plan?", a: `Yes. Web3Forms free allows 250 submissions a month and the ${product.name} Free plan allows 250 submissions a month, with spam never counted.` },
      { q: `What happens to submissions over the ${product.name} limit?`, a: "They are held, not dropped, so you can release them after upgrading." },
    ],
  },
];

export const comparisonBySlug = (slug: string) => comparisons.find((c) => c.slug === slug);
export const compareEntries = comparisons;
