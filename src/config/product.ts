/**
 * THE single source of product identity, plans, limits, flags and copy constants.
 * KIT_COPY.md step 2: a new product edits this file (and the tokens in globals.css) and nothing else in src/lib.
 */

export type PlanId = "free" | "starter" | "pro" | "agency";
export type Interval = "month" | "year";
export type MeterId = "submissions" | "seats" | "recipients" | "integrations" | "storage_mb";

export interface PlanPrice {
  interval: Interval;
  /** USD cents. Real prices only (playbook §2). */
  usd: number;
  /** Stripe lookup key, always `${product.slug}_${plan}_${interval}` (app isolation, C-28). */
  lookupKey: string;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Empty for the free plan. */
  prices: PlanPrice[];
  limits: Record<MeterId, number>;
  /** Short plain-text differences shown in the pricing table. */
  highlights: string[];
  cta: string;
  featured?: boolean;
  /** Days of trial. 0 = no trial (Postslot: the Free plan is the trial). */
  trialDays: number;
}

const slug = "postslot";
const price = (plan: PlanId, interval: Interval, usd: number): PlanPrice => ({
  interval,
  usd,
  lookupKey: `${slug}_${plan}_${interval === "month" ? "monthly" : "annual"}`,
});

export const product = {
  slug,
  name: "Postslot",
  fullName: "Postslot by BufferSol",
  company: "BufferSol Technologies",
  companyUrl: "https://buffersoltech.com",
  host: "postslot.buffersoltech.com",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://postslot.buffersoltech.com",
  supportEmail: "support@buffersoltech.com",
  legalEmail: "legal@buffersoltech.com",
  mailFrom: "Postslot by BufferSol <no-reply@postslot.buffersoltech.com>",
  description:
    "A form endpoint for static, Jamstack and AI-built sites. Every submission gets a delivery receipt, spam never counts toward your quota and over-limit submissions are held, never dropped.",
  tagline: "Form submissions that arrive, with a receipt to prove it",
  /** Legal entity details used by the legal templates. */
  legal: {
    entity: "BufferSol Technologies",
    jurisdiction: "{{jurisdiction}}",
    address: "{{registered address}}",
    effectiveDate: "2026-11-05",
  },
  subProcessors: [
    { name: "Vercel Inc.", purpose: "Hosting and edge network", location: "United States" },
    { name: "MongoDB Inc. (Atlas)", purpose: "Database hosting", location: "United States (AWS us-east-1)" },
    { name: "Stripe Inc.", purpose: "Payments and invoicing", location: "United States" },
    { name: "Email delivery provider", purpose: "Transactional email until our own mail servers are live", location: "United States" },
  ],
  currency: "usd" as const,
  /** Default billing interval shown first in the pricing toggle. */
  defaultInterval: "year" as Interval,
  plans: [
    {
      id: "free",
      name: "Free",
      tagline: "For one site and a first form",
      prices: [],
      limits: { submissions: 250, seats: 1, recipients: 1, integrations: 0, storage_mb: 0 },
      highlights: ["250 submissions a month, spam never counts", "Unlimited forms and domains", "1 verified recipient", "90 day history"],
      cta: "Start free",
      trialDays: 0,
    },
    {
      id: "starter",
      name: "Starter",
      tagline: "For freelancers with a few client sites",
      prices: [price("starter", "year", 2400)],
      limits: { submissions: 5000, seats: 1, recipients: 3, integrations: 1, storage_mb: 0 },
      highlights: ["5,000 submissions a month", "3 recipients", "Webhooks and 1 integration", "6 month history"],
      cta: "Choose Starter",
      trialDays: 0,
    },
    {
      id: "pro",
      name: "Pro",
      tagline: "For developers who need proof of delivery",
      prices: [price("pro", "month", 749), price("pro", "year", 7400)],
      limits: { submissions: 10000, seats: 3, recipients: 5, integrations: 5, storage_mb: 5120 },
      highlights: ["10,000 submissions a month", "Custom sending domain", "90 day delivery log", "Autoresponder and file uploads", "3 seats"],
      cta: "Choose Pro",
      featured: true,
      trialDays: 0,
    },
    {
      id: "agency",
      name: "Agency",
      tagline: "For studios running many client sites",
      prices: [price("agency", "month", 1949), price("agency", "year", 19900)],
      limits: { submissions: 20000, seats: 10, recipients: 10, integrations: 10, storage_mb: 10240 },
      highlights: ["20,000 submissions a month", "Client workspaces", "White label emails", "10 seats", "Priority support"],
      cta: "Choose Agency",
      trialDays: 0,
    },
  ] satisfies Plan[],
  /** Grace period after a failed payment (past_due keeps the plan, C-20) before limits fall to Free. */
  graceDays: 7,
  /** Remote flag defaults (overridden by APP_FLAGS env JSON and the Mongo `config` collection). */
  flags: {
    payments_enabled: "on",
    signups_enabled: "on",
    maintenance: "off",
  } as Record<string, string>,
  nav: [
    { href: "/pricing", label: "Pricing" },
    { href: "/docs", label: "Docs" },
  ],
} as const;

export type Product = typeof product;
export const plans: readonly Plan[] = product.plans;
export const planById = (id: string): Plan | undefined => plans.find((p) => p.id === id);
export const freePlan = plans.find((p) => p.prices.length === 0) ?? plans[0]!;
export const allLookupKeys = (): string[] => plans.flatMap((p) => p.prices.map((x) => x.lookupKey));
export const planForLookupKey = (key: string | null | undefined): { plan: Plan; price: PlanPrice } | null => {
  if (!key) return null;
  for (const plan of plans) for (const p of plan.prices) if (p.lookupKey === key) return { plan, price: p };
  return null;
};
