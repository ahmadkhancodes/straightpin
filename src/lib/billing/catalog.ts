import type Stripe from "stripe";
import { allLookupKeys, planForLookupKey, type Interval, type PlanId } from "@/config/product";

// Ported from trayo server/billing.ts (lookupKeys/appPrices/plansFor/amountFor) with a 60 s cache (2.2 #7).
export type Currency = "usd" | "gbp" | "cad";
export const asCurrency = (c: unknown): Currency => (c === "gbp" || c === "cad" ? c : "usd");

export function amountFor(price: Pick<Stripe.Price, "currency" | "unit_amount" | "currency_options">, currency: Currency): number {
  if (price.currency === currency) return price.unit_amount ?? 0;
  return price.currency_options?.[currency]?.unit_amount ?? price.unit_amount ?? 0;
}

let cache: { app: string; at: number; prices: Stripe.Price[] } | null = null;

/** Only prices whose lookup_key starts with `${app}_` AND metadata.app === app (C-28). */
export async function appPrices(stripe: Pick<Stripe, "prices">, app: string, now = Date.now()): Promise<Stripe.Price[]> {
  if (cache && cache.app === app && now - cache.at < 60_000) return cache.prices;
  const res = await stripe.prices.list({ lookup_keys: allLookupKeys(), active: true, expand: ["data.currency_options"], limit: 20 });
  const prices = res.data.filter((p) => p.metadata?.app === app && !!p.lookup_key && p.lookup_key.startsWith(`${app}_`));
  cache = { app, at: now, prices };
  return prices;
}
export const clearPriceCache = () => { cache = null; };

export async function findPrice(stripe: Pick<Stripe, "prices">, app: string, plan: PlanId, interval: Interval) {
  const prices = await appPrices(stripe, app);
  return prices.find((p) => {
    const m = planForLookupKey(p.lookup_key);
    return m && m.plan.id === plan && m.price.interval === interval;
  }) ?? null;
}
