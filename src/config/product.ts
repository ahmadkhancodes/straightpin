/**
 * THE single source of product identity, plans, limits, flags and copy constants.
 * KIT_COPY.md step 2: a new product edits this file (and the tokens in globals.css) and nothing else in src/lib.
 */

/**
 * THE crawl and alert cadence. Production is Vercel Hobby: one run of each scheduled job per day, 60 s per run.
 * Every public sentence about "how often" reads from `cadence`, and a test fails if page copy disagrees.
 * Flip to "hourly" only when a faster scheduler (VPS or Pro cron) really runs the jobs hourly.
 */
export const CADENCE: "daily" | "hourly" = "daily";
const daily = CADENCE === "daily";
export const cadence = {
  id: CADENCE,
  /** "We check company hiring pages ___." */
  checkPhrase: daily ? "every day" : "every hour",
  /** "Paid plans get alerts ___." */
  alertPhrase: daily ? "once a day, with every new match since the last email" : "within the hour",
  /** Short form for lists and cards. */
  alertShort: daily ? "a daily email of new matches" : "an email within the hour of a new match",
  /** Name of a paid saved search. */
  alertName: daily ? "saved alert" : "instant alert",
  /** Who the Free digest goes to and when. */
  digestPhrase: daily ? "one email a day" : "one email a day at 8:00 in your time zone",
  /** Shown instead of a "checked N min ago" claim when a job's last check is described. */
  recheckPhrase: daily ? "re-checked first on every daily crawl" : "re-checked every 15 minutes",
  /** Hours before one board is due again after a good crawl. */
  crawlEveryHours: daily ? 20 : 1, // 20 not 24: Hobby cron time drifts, a board must be due at the next daily run
} as const;

export type PlanId = "free" | "weekly" | "monthly" | "lifetime" | "plus";
/** "once" = one-time payment (Lifetime). */
export type Interval = "week" | "month" | "year" | "once";
/** Meters: opens are counted per UTC day, saves are a running total. */
export type MeterId = "opens" | "saves";
/** Stand-in for "no limit" that survives JSON (Infinity does not). */
export const UNLIMITED = 1_000_000;

/** Short text for a price: "per week", "per month", "per year", "one time". */
export const intervalText = (i: Interval): string => (i === "once" ? "one time" : `per ${i}`);

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
  /** How many saved alerts (saved searches that email new matches, see `cadence.alertPhrase`) the plan keeps. Free gets the daily digest instead. */
  alertLimit: number;
  /** Short plain-text differences shown in the pricing table. */
  highlights: string[];
  cta: string;
  featured?: boolean;
  /** Days of trial. 0 = no trial (Straightpin: the Free plan is the trial). */
  trialDays: number;
  /**
   * False while the plan's features are not built: it is shown as "not on sale yet", has no buy button and
   * Checkout refuses it (docs/REVIEW.md P0-1). Never sell a feature that does not exist.
   */
  onSale: boolean;
}

const slug = "straightpin";
const price = (plan: PlanId, interval: Interval, usd: number): PlanPrice => ({
  interval,
  usd,
  lookupKey: `${slug}_${plan}_${interval}`,
});

export const product = {
  slug,
  name: "Straightpin",
  fullName: "Straightpin by BufferSol",
  company: "BufferSol Technologies",
  companyUrl: "https://buffersoltech.com",
  host: "straightpin.buffersoltech.com",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://straightpin.buffersoltech.com",
  supportEmail: "contact@buffersoltech.com",
  legalEmail: "contact@buffersoltech.com",
  mailFrom: "Straightpin <hello@straightpin.buffersoltech.com>",
  description:
    "Jobs straight from company careers pages. Staffing agencies removed, the real first posted date and repost count on every job, and a direct Apply at company link. Half the price of the leader.",
  tagline: "Jobs straight from company careers pages. Half the price.",
  /** Legal entity details used by the legal templates. */
  legal: {
    entity: "BufferSol Technologies LLC",
    jurisdiction: "the State of New York, United States",
    address: "447 W Broadway, 2nd Floor Suite #1964, New York, NY 10013, United States",
    effectiveDate: "2026-11-05",
  },
  subProcessors: [
    { name: "Vercel Inc.", purpose: "Hosting and edge network", location: "United States" },
    { name: "MongoDB Inc. (Atlas)", purpose: "Database hosting", location: "United States (AWS us-east-1)" },
    { name: "Stripe Inc.", purpose: "Payments and invoicing", location: "United States" },
    { name: "Email delivery provider", purpose: "Transactional email until our own mail servers are live", location: "United States" },
  ],
  currency: "usd" as const,
  /** Monthly is pre-selected (docs/brief.md). */
  defaultInterval: "month" as Interval,
  /** Refund window in days, all plans (docs/brief.md). */
  refundDays: 7,
  /** Lifetime is capped at the first buyers, then reviewed. */
  lifetimeCap: 1000,
  plans: [
    {
      id: "free",
      name: "Free",
      tagline: "Browse everything, no card",
      prices: [],
      limits: { opens: 5, saves: 10 },
      alertLimit: 0,
      highlights: ["Browse all titles and companies", "5 job opens a day", "10 saved jobs", "Daily email digest"],
      cta: "Start free",
      trialDays: 0,
      onSale: true,
    },
    {
      id: "weekly",
      name: "Weekly",
      tagline: "Pay by the week, cancel any time",
      prices: [price("weekly", "week", 499)],
      limits: { opens: UNLIMITED, saves: UNLIMITED },
      alertLimit: 3,
      highlights: ["Unlimited opens", `Up to 3 ${cadence.alertName}s`, "Unlimited saves", "Ghost and repost signals"],
      cta: "Choose Weekly",
      trialDays: 0,
      onSale: true,
    },
    {
      id: "monthly",
      name: "Monthly",
      tagline: "Everything in Weekly, for less per week",
      prices: [price("monthly", "month", 1099)],
      limits: { opens: UNLIMITED, saves: UNLIMITED },
      alertLimit: 5,
      highlights: ["Everything in Weekly", `Up to 5 ${cadence.alertName}s`, "About half the weekly price over a month"],
      cta: "Choose Monthly",
      featured: true,
      trialDays: 0,
      onSale: true,
    },
    {
      id: "lifetime",
      name: "Lifetime",
      tagline: "One payment, core plan forever",
      prices: [price("lifetime", "once", 2399)],
      limits: { opens: UNLIMITED, saves: UNLIMITED },
      alertLimit: 5,
      highlights: ["Core plan forever, no Plus features", "First 1,000 buyers, then reviewed", "One time payment"],
      cta: "Get Lifetime",
      trialDays: 0,
      onSale: true,
    },
    {
      id: "plus",
      name: "Plus",
      tagline: "For a serious search",
      prices: [price("plus", "month", 1999), price("plus", "year", 9899)],
      limits: { opens: UNLIMITED, saves: UNLIMITED },
      alertLimit: 15,
      highlights: ["Everything in Monthly", "In browser resume match check", "Cover letter outline template", `Priority alerts, followed companies ${cadence.recheckPhrase}`],
      cta: "Not on sale yet",
      trialDays: 0,
      onSale: false,
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
    { href: "/#pick-field", label: "Jobs" },
    { href: "/pricing", label: "Pricing" },
    { href: "/how-we-check", label: "How we check" },
  ],
} as const;

export type Product = typeof product;
export const plans: readonly Plan[] = product.plans;
export const planById = (id: string): Plan | undefined => plans.find((p) => p.id === id);
export const freePlan = plans.find((p) => p.prices.length === 0) ?? plans[0]!;
/** Plans a customer can buy today (paid and on sale). */
export const plansOnSale = (): Plan[] => plans.filter((p) => p.onSale && p.prices.length > 0);
export const allLookupKeys = (): string[] => plans.flatMap((p) => p.prices.map((x) => x.lookupKey));
export const planForLookupKey = (key: string | null | undefined): { plan: Plan; price: PlanPrice } | null => {
  if (!key) return null;
  for (const plan of plans) for (const p of plan.prices) if (p.lookupKey === key) return { plan, price: p };
  return null;
};
