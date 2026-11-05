import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { product, plans, intervalText, planById, type Plan, type PlanPrice } from "@/config/product";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

const PROMISE = `Price shown before you sign up. Cancel in two taps. Changed your mind in ${product.refundDays} days? Full refund. No crossed out prices, no countdowns.`;

function PlanCard({ plan, price }: { plan: Plan; price: PlanPrice | null }) {
  const href = price ? `/sign-in?plan=${plan.id}&interval=${price.interval}` : "/sign-in";
  return (
    <li className={cn("flex min-w-0 flex-col rounded-lg border bg-surface-raised p-6", plan.featured ? "border-action ring-1 ring-action" : "border-border")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="heading-6 text-text">{plan.name}</h3>
        {plan.featured ? <span className="caption-3 text-action">Pre selected</span> : null}
      </div>
      <p className="body-6 mt-1 text-text-subtle">{plan.tagline}</p>
      <p className="mt-6 flex items-baseline gap-2">
        <span className="heading-3 tabular-nums text-text">{price ? money(price.usd) : "$0"}</span>
        <span className="body-6 text-text-subtle">{price ? intervalText(price.interval) : "free"}</span>
      </p>
      <Link href={href} className={cn(buttonClass(plan.featured ? "primary" : "secondary", "md"), "mt-4 w-full")}>{plan.cta}</Link>
      <p className="caption-2 mt-2 text-text-subtle">{price ? "Cancel in two taps." : "No card needed."}</p>
      <ul className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
        {plan.highlights.map((h) => (
          <li key={h} className="body-6 flex items-start gap-2 text-text">
            <Check size={16} weight="regular" aria-hidden className="mt-0.5 shrink-0 text-success" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * Prices come from product.ts only. `compact` shows Free, Weekly, Monthly plus a Lifetime line (landing page);
 * the full table adds Lifetime and Plus (monthly and annual) cards.
 */
export function PricingTable({ id = "pricing", title, compact = false }: { id?: string; title?: string; compact?: boolean }) {
  const lifetime = planById("lifetime");
  const lifetimePrice = lifetime?.prices[0];
  const plus = planById("plus");
  const core = plans.filter((p) => p.id === "free" || p.id === "weekly" || p.id === "monthly");
  return (
    <div id={id}>
      {title ? <h2 id={`${id}-title`} className="heading-4 md:heading-2 max-w-2xl text-text">{title}</h2> : null}
      <ul className={cn("grid gap-4 md:grid-cols-3", title ? "mt-8 md:mt-12" : "")}>
        {core.map((p) => <PlanCard key={p.id} plan={p} price={p.prices[0] ?? null} />)}
      </ul>
      {compact && lifetime && lifetimePrice ? (
        <p className="body-3 mt-6 text-text">
          <b className="font-semibold">Lifetime {money(lifetimePrice.usd)} once.</b> Core plan forever. First {product.lifetimeCap.toLocaleString("en-US")} buyers.{" "}
          <Link href="/pricing" className="text-action underline underline-offset-4 focus-visible:focus-ring">All plans, including Plus</Link>
        </p>
      ) : null}
      {!compact && lifetime && lifetimePrice && plus ? (
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          <PlanCard plan={lifetime} price={lifetimePrice} />
          {plus.prices.map((pp) => (
            <PlanCard key={pp.lookupKey} plan={{ ...plus, name: `Plus ${pp.interval === "year" ? "annual" : "monthly"}`, featured: false }} price={pp} />
          ))}
        </ul>
      ) : null}
      <p className="body-6 mt-6 max-w-2xl text-text-subtle">{PROMISE}</p>
    </div>
  );
}
