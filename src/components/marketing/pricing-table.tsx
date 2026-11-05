"use client";
import { useState } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { product, plans, type Interval, type Plan, type PlanPrice } from "@/config/product";
import { buttonClass } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/components/ui/cn";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

/** The price shown for the chosen interval; a plan with only one interval shows that one. */
function priceFor(plan: Plan, interval: Interval): PlanPrice | null {
  if (plan.prices.length === 0) return null;
  return plan.prices.find((p) => p.interval === interval) ?? plan.prices[0] ?? null;
}

/** Whole-percent saving of paying yearly, for every plan that sells both intervals. */
function annualSavings(): { min: number; max: number } | null {
  const pct = plans.flatMap((p) => {
    const m = p.prices.find((x) => x.interval === "month");
    const y = p.prices.find((x) => x.interval === "year");
    return m && y ? [Math.round((1 - y.usd / (m.usd * 12)) * 100)] : [];
  });
  return pct.length ? { min: Math.min(...pct), max: Math.max(...pct) } : null;
}

const RISK_FREE = "No credit card needed.";
const RISK_PAID = "Cancel anytime from your account.";

export function PricingTable({ id = "pricing", title }: { id?: string; title?: string }) {
  const [interval, setBilling] = useState<Interval>(product.defaultInterval);
  const saving = annualSavings();
  const savingText = saving ? (saving.min === saving.max ? `${saving.max}%` : `${saving.min}% to ${saving.max}%`) : null;
  const options: { id: Interval; label: string }[] = [
    { id: "month", label: "Monthly" },
    { id: "year", label: "Annual" },
  ];

  return (
    <div id={id}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        {title ? <h2 id={`${id}-title`} className="heading-4 md:heading-2 text-text">{title}</h2> : <span />}
        {saving ? (
          <div className="flex flex-col gap-2 md:items-end">
            <div role="group" aria-label="Billing interval" className="inline-flex w-fit rounded-lg border border-border bg-surface-raised p-1">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={interval === o.id}
                  onClick={() => setBilling(o.id)}
                  className={cn(
                    "min-h-11 rounded-md px-4 button-sm transition-colors duration-300 ease-out-kit focus-visible:focus-ring",
                    interval === o.id ? "bg-surface text-text" : "text-text-subtle hover:text-text",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="caption-2 text-text-subtle">Annual billing saves {savingText} on plans sold both ways.</p>
          </div>
        ) : null}
      </div>

      <ul className="mt-8 grid gap-4 md:mt-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-y-0">
        {plans.map((plan) => {
          const price = priceFor(plan, interval);
          const free = !price;
          const href = `/sign-in?plan=${plan.id}&interval=${price?.interval ?? interval}`;
          return (
            <li
              key={plan.id}
              className={cn(
                "grid grid-rows-[auto_auto_auto_auto_1fr] rounded-lg border bg-surface p-6 lg:row-span-5 lg:grid-rows-subgrid",
                plan.featured ? "border-action ring-1 ring-action" : "border-border",
              )}
            >
              <div className="pb-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="heading-6 text-text">{plan.name}</h3>
                  {plan.featured ? <span className="caption-3 text-action">Most popular</span> : null}
                </div>
                <p className="body-6 mt-1 text-text-subtle">{plan.tagline}</p>
              </div>
              <p className="flex items-baseline gap-1 pb-6">
                <span className="heading-3 tabular-nums text-text">{free ? "$0" : money(price.usd)}</span>
                <span className="body-6 text-text-subtle">{free ? "free" : `per ${price.interval}`}</span>
              </p>
              <div className="pb-3">
                <Link href={href} className={cn(buttonClass(plan.featured ? "primary" : "secondary", "md"), "w-full")}>{plan.cta}</Link>
              </div>
              <p className="caption-2 pb-6 text-text-subtle">{free ? RISK_FREE : RISK_PAID}</p>
              <ul className="flex flex-col gap-2 border-t border-border pt-6">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 body-6 text-text">
                    <Check size={16} weight="regular" aria-hidden className="mt-0.5 shrink-0 text-success" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
