import type { Interval } from "@/config/product";
import { planById } from "@/config/product";

/** Same-origin paths only. Anything else (absolute URLs, //host, backslashes) falls back. */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/** Where to go after sign-in: pricing hand-off (?plan&interval) wins, then ?next, then /app. */
export function afterSignIn(p: { next?: string | null; plan?: string | null; interval?: string | null }): string {
  const plan = p.plan ? planById(p.plan) : undefined;
  if (plan && plan.id !== "free") {
    const interval: Interval = p.interval === "month" ? "month" : "year";
    return `/app/billing?plan=${plan.id}&interval=${interval}`;
  }
  return safeNext(p.next);
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "workspace";
