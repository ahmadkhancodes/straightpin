import { planById, product } from "@/config/product";
import type { CompareValue } from "@/components/marketing/compare-table";

export interface CompareEntry {
  slug: string;
  competitor: string;
  title: string;
  description: string;
  headline: string;
  intro: string;
  /** Date the competitor facts were read. */
  checked: string;
  rows: { label: string; values: [CompareValue, CompareValue] }[];
  fitNote: string;
  sources: { label: string; url: string }[];
  faq: { q: string; a: string }[];
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const monthly = dollars(planById("monthly")?.prices[0]?.usd ?? 0);
const weekly = dollars(planById("weekly")?.prices[0]?.usd ?? 0);
const lifetime = dollars(planById("lifetime")?.prices[0]?.usd ?? 0);

/** Compare page data: add an entry and /compare/<slug> exists. Competitor facts come only from docs/brief.md, dated. */
export const comparisons: CompareEntry[] = [
  {
    slug: "directroles",
    competitor: "directroles.net",
    title: `${product.name} vs directroles.net`,
    description: `Same idea as directroles.net, about half the price. Prices checked 3 Nov 2026: directroles.net $21 a month, ${product.name} ${monthly} a month.`,
    headline: "Same idea as the pricier site. About half the price.",
    intro: `directroles.net: $21 a month. ${product.fullName}: ${monthly} a month. Prices checked 3 Nov 2026.`,
    checked: "3 Nov 2026",
    rows: [
      { label: "Monthly price", values: ["$21 a month", `${monthly} a month`] },
      { label: "Weekly price", values: ["$10.50 a week", `${weekly} a week`] },
      { label: "Lifetime price", values: ["$47 once", `${lifetime} once, first 1,000 buyers`] },
      { label: "Price shown before sign up", values: ["After the quiz", true] },
      { label: "Crossed out \"was\" prices", values: ["Yes", "Never"] },
      { label: "Refund window", values: ["None stated", `${product.refundDays} days, full refund`] },
      { label: "Staffing agency removal", values: [true, true] },
      { label: "First posted date", values: ["Partial", true] },
      { label: "Repost count and old posting label", values: [false, true] },
      { label: "Free tier", values: ["Free match count", "5 opens a day, 10 saved jobs"] },
    ],
    fitNote: "The idea is the same: jobs from the employer's own hiring pages, no recruiter in between. HiringCafe is free and has far more jobs. We sell guided matching, alerts and trust signals.",
    sources: [{ label: "directroles.net, read 3 Nov 2026", url: "https://directroles.net" }],
    faq: [
      { q: `Is ${product.name} cheaper than directroles.net?`, a: `On 3 Nov 2026 directroles.net charged $21 a month, $10.50 a week or $47 once. ${product.name} charges ${monthly} a month, ${weekly} a week or ${lifetime} once.` },
      { q: "Can I get a refund?", a: `Yes. ${product.name} refunds any payment within ${product.refundDays} days, no questions. directroles.net did not state a refund window when we checked.` },
      { q: "Do you say their jobs are fake?", a: "No. Both sites point to jobs on the employer's own page. The difference is price, a refund, and the repost and old posting labels we add." },
    ],
  },
];

export const comparisonBySlug = (slug: string) => comparisons.find((c) => c.slug === slug);
export const compareEntries = comparisons;
