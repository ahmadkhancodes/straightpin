/**
 * THE single source of product identity, plans, limits, flags and copy constants.
 * KIT_COPY.md step 2: a new product edits this file (and the tokens in globals.css) and nothing else in src/lib.
 */

export type PlanId = "free" | "weekly" | "monthly" | "lifetime" | "plus";
export type Interval = "week" | "month" | "year" | "once";
export type MeterId = "opens_day" | "saved_jobs" | "followed_companies" | "instant_alerts";

/** Stands in for "no limit" so limits stay plain numbers (JSON safe). Show as "Unlimited". */
export const UNLIMITED = 1_000_000;

export interface PlanPrice {
  interval: Interval;
  /** USD cents. Real prices only (playbook §2). */
  usd: number;
  /** Stripe lookup key, `straightpin_weekly|monthly|lifetime|plus_monthly|plus_annual` (app isolation, C-28). */
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
  /** Plan exists in Stripe but is not sold yet (Plus is v1). The UI hides it from checkout. */
  comingSoon?: boolean;
  /** Days of trial. 0 = no trial (Straightpin: the Free plan is the trial, no card). */
  trialDays: number;
}

const slug = "straightpin";
/** Lookup keys follow docs/brief.md: straightpin_weekly, _monthly, _lifetime, _plus_monthly, _plus_annual. */
const price = (plan: PlanId, interval: Interval, usd: number): PlanPrice => ({
  interval,
  usd,
  lookupKey:
    plan === "plus"
      ? `${slug}_plus_${interval === "year" ? "annual" : "monthly"}`
      : `${slug}_${plan}`,
});

export const product = {
  slug,
  name: "Straightpin",
  fullName: "Straightpin by BufferSol",
  company: "BufferSol Technologies",
  companyUrl: "https://buffersoltech.com",
  host: "straightpin.buffersoltech.com",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://straightpin.buffersoltech.com",
  supportEmail: "support@buffersoltech.com",
  legalEmail: "legal@buffersoltech.com",
  mailFrom: "Straightpin by BufferSol <no-reply@straightpin.buffersoltech.com>",
  description:
    "Jobs posted on the employer's own careers page, staffing agencies removed, first posted date on every job. Free to start. $10.99 a month, 7 day refund.",
  tagline: "Jobs straight from company careers pages. Half the price.",
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
    { name: "Cloudflare Inc.", purpose: "DNS, scheduled jobs and file storage", location: "United States" },
  ],
  currency: "usd" as const,
  /** Default interval used where a plan has more than one price (Plus). */
  defaultInterval: "month" as Interval,
  plans: [
    {
      id: "free",
      name: "Free",
      tagline: "See every title and company. No card.",
      prices: [],
      limits: { opens_day: 5, saved_jobs: 10, followed_companies: 0, instant_alerts: 0 },
      highlights: ["Browse all titles and companies", "5 free job opens a day", "10 saved jobs", "Daily email at 8:00"],
      cta: "Start free",
      trialDays: 0,
    },
    {
      id: "weekly",
      name: "Weekly",
      tagline: "For a short, focused search",
      prices: [price("weekly", "week", 499)],
      limits: { opens_day: UNLIMITED, saved_jobs: UNLIMITED, followed_companies: 0, instant_alerts: 1 },
      highlights: ["Unlimited job opens", "Instant alerts", "Unlimited saved jobs", "Ghost and repost signals"],
      cta: "Choose Weekly",
      trialDays: 0,
    },
    {
      id: "monthly",
      name: "Monthly",
      tagline: "Pre selected. Weekly plus the tracker.",
      prices: [price("monthly", "month", 1099)],
      limits: { opens_day: UNLIMITED, saved_jobs: UNLIMITED, followed_companies: UNLIMITED, instant_alerts: 1 },
      highlights: ["Everything in Weekly", "Application tracker", "Follow companies"],
      cta: "Choose Monthly",
      featured: true,
      trialDays: 0,
    },
    {
      id: "lifetime",
      name: "Lifetime",
      tagline: "Pay once. Core plan forever.",
      prices: [price("lifetime", "once", 2399)],
      limits: { opens_day: UNLIMITED, saved_jobs: UNLIMITED, followed_companies: UNLIMITED, instant_alerts: 1 },
      highlights: ["Everything in Monthly, forever", "First 1,000 buyers", "No Plus features"],
      cta: "Buy Lifetime",
      trialDays: 0,
    },
    {
      id: "plus",
      name: "Plus",
      tagline: "Coming soon: resume match check and priority alerts",
      prices: [price("plus", "month", 1999), price("plus", "year", 9899)],
      limits: { opens_day: UNLIMITED, saved_jobs: UNLIMITED, followed_companies: UNLIMITED, instant_alerts: 1 },
      highlights: ["Everything in Monthly", "Resume match check in your browser, nothing uploaded", "Cover letter outline", "Followed companies re-checked every 15 minutes"],
      cta: "Join the waitlist",
      comingSoon: true,
      trialDays: 0,
    },
  ] satisfies Plan[],
  /** Lifetime is capped for the first buyers (brief). */
  lifetimeCap: 1000,
  /** Refund window in days (brief: 7 day no questions refund). */
  refundDays: 7,
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
    { href: "/about/data", label: "How we check" },
  ],
} as const;

export type Product = typeof product;
export const plans: readonly Plan[] = product.plans;
export const planById = (id: string): Plan | undefined => plans.find((p) => p.id === id);
export const freePlan = plans.find((p) => p.prices.length === 0) ?? plans[0]!;
/** Plans that can be bought today. */
export const sellablePlans: readonly Plan[] = plans.filter((p) => p.prices.length > 0 && !p.comingSoon);
export const allLookupKeys = (): string[] => plans.flatMap((p) => p.prices.map((x) => x.lookupKey));
export const planForLookupKey = (key: string | null | undefined): { plan: Plan; price: PlanPrice } | null => {
  if (!key) return null;
  for (const plan of plans) for (const p of plan.prices) if (p.lookupKey === key) return { plan, price: p };
  return null;
};
