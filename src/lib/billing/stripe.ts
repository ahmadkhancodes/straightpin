import Stripe from "stripe";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

let cached: { key: string; client: Stripe } | null = null;

/** Stripe client, or null in stub mode (no STRIPE_SECRET_KEY yet). */
export function getStripe(): Stripe | null {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) return null;
  if (cached?.key === key) return cached.client;
  cached = { key, client: new Stripe(key, { appInfo: { name: "buffersol-kit" }, maxNetworkRetries: 2 }) };
  return cached.client;
}

export function requireStripe(): Stripe {
  const s = getStripe();
  if (!s) throw new HttpError(503, "billing_unavailable");
  return s;
}
