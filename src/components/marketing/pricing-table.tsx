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

const PROMISE = `Price shown before you sign up. Cancel in two taps. Changed your mind within ${product.refundDays} days of your first payment? Full refund. No crossed out prices, no countdowns.`;

/** One line of the rate card: plan and promise | price in figures | what you get | action. Stacks at 375. */
function PlanCard({ plan, price, level = "h3" }: { plan: Plan; price: PlanPrice | null; level?: "h2" | "h3" }) {
  const H = level;
  const href = price ? `/sign-in?plan=${plan.id}&interval=${price.interval}` : "/sign-in";
  return (
    <li className={cn("grid min-w-0 gap-4 px-4 py-6 md:grid-cols-12 md:gap-6 md:px-6", plan.featured ? "bg-brand-tint" : "bg-surface-raised")}>
      <div className="md:col-span-3">
        {plan.featured ? <p className="kicker mb-2 w-fit bg-highlight px-1.5 py-0.5 text-on-highlight">Pre selected</p> : null}
        <H className="heading-5 text-text">{plan.name}</H>
        <p className="body-6 mt-1 text-text-subtle">{plan.tagline}</p>
      </div>
      <p className="flex items-baseline gap-2 md:col-span-2 md:flex-col md:gap-0">
        <span className="heading-4 figures text-text">{price ? money(price.usd) : "$0"}</span>
        <span className="body-6 text-text-subtle">{price ? intervalText(price.interval) : "free"}</span>
      </p>
      <ul className="flex flex-col gap-1.5 md:col-span-4">
        {plan.highlights.map((h) => (
          <li key={h} className="body-6 flex items-start gap-2 text-text">
            <Check size={16} weight="bold" aria-hidden className="mt-0.5 shrink-0 text-success" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <div className="md:col-span-3">
        {plan.onSale ? (
          <>
            <Link href={href} className={cn(buttonClass(plan.featured ? "primary" : "secondary", "md"), "w-full")}>{plan.cta}</Link>
            <p className="caption-2 mt-2 text-text-subtle">{!price ? "No card needed." : price.interval === "once" ? "One payment, nothing renews." : "Cancel in two taps."}</p>
          </>
        ) : (
          <p className="body-6 border border-dashed border-border-strong px-4 py-3 text-text">
            Not on sale yet. These features are still being built, so we do not take money for them.
          </p>
        )}
      </div>
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
  const level = title ? "h3" : "h2";
  const core = plans.filter((p) => p.id === "free" || p.id === "weekly" || p.id === "monthly");
  return (
    <div id={id}>
      {title ? <h2 id={`${id}-title`} className="heading-4 md:heading-2 max-w-2xl text-text">{title}</h2> : null}
      <ul className={cn("divide-y divide-border border-y-2 border-rule", title ? "mt-8 md:mt-12" : "")} aria-label="Plans">
        {core.map((p) => <PlanCard key={p.id} plan={p} price={p.prices[0] ?? null} level={level} />)}
        {!compact && lifetime && lifetimePrice ? <PlanCard plan={lifetime} price={lifetimePrice} level={level} /> : null}
        {!compact && plus
          ? plus.prices.map((pp) => (
              <PlanCard key={pp.lookupKey} plan={{ ...plus, name: `Plus ${pp.interval === "year" ? "annual" : "monthly"}`, featured: false }} price={pp} level={level} />
            ))
          : null}
      </ul>
      {compact && lifetime && lifetimePrice ? (
        <p className="body-3 mt-6 text-text">
          <b className="font-semibold">Lifetime <span className="figures">{money(lifetimePrice.usd)}</span> once.</b> Core plan forever. First {product.lifetimeCap.toLocaleString("en-US")} buyers.{" "}
          <Link href="/pricing" className="inline-flex min-h-11 items-center text-action underline underline-offset-4 focus-visible:focus-ring">All plans</Link>
        </p>
      ) : null}
      <p className="body-6 mt-6 max-w-2xl text-text-subtle">{PROMISE}</p>
    </div>
  );
}
