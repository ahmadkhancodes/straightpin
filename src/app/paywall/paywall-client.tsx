"use client";
import { X } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/app/api";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/states";
import { intervalText, product, type Interval, type PlanId } from "@/config/product";

interface Option {
  key: string;
  plan: PlanId;
  interval: Interval;
  name: string;
  usd: number;
  note: string;
}

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

/** Every option comes from product.ts: the screen never carries its own prices. */
const OPTIONS: Option[] = product.plans.flatMap((pl) =>
  pl.prices.map((pr) => ({
    key: `${pl.id}:${pr.interval}`,
    plan: pl.id,
    interval: pr.interval,
    name: pl.id === "plus" ? `Plus ${pr.interval === "year" ? "yearly" : "monthly"}` : pl.name,
    usd: pr.usd,
    note: pl.tagline,
  })),
);

const DEFAULT_KEY = OPTIONS.find((o) => o.plan === "monthly" && o.interval === product.defaultInterval)?.key ?? OPTIONS[0]!.key;
const everyText = (i: Interval) => intervalText(i).replace("per ", "every ");

export function PaywallClient(p: { title: string; body: string; from: string; signedIn: boolean; alreadyPaid: boolean; lifetimeLeft: number }) {
  const [sel, setSel] = useState(DEFAULT_KEY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const soldOut = p.lifetimeLeft <= 0;
  const chosen = OPTIONS.find((o) => o.key === sel)!;
  const renews = chosen.interval === "once" ? "One payment, no renewal." : `Renews ${everyText(chosen.interval)} at ${money(chosen.usd)} until you cancel.`;

  async function go() {
    setBusy(true);
    setError(null);
    const r = await api<{ url: string }>("/api/billing/checkout", { body: { plan: chosen.plan, interval: chosen.interval } });
    if (r.ok && r.data.url) {
      window.location.assign(r.data.url);
      return;
    }
    setBusy(false);
    if (!r.ok) setError(r.code === "billing_unavailable" ? "Payments are not switched on yet. Nothing was charged." : r.message);
  }

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-4 sm:py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="caption-3 text-text-subtle">{product.name}</p>
          <h1 className="heading-4 text-text">{p.title}</h1>
        </div>
        <Link href={p.from} aria-label="Close and go back" className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border-strong text-text hover:bg-surface-raised focus-visible:focus-ring">
          <X size={20} weight="regular" aria-hidden />
        </Link>
      </header>
      <p className="body-4 text-text-subtle">{p.body}</p>

      {p.alreadyPaid ? <Notice tone="success" title="You already have a paid plan">Manage it in your <Link href="/account" className="text-action underline underline-offset-4">account</Link>.</Notice> : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Plan</legend>
        {OPTIONS.map((o) => {
          const disabled = o.interval === "once" && soldOut;
          const on = sel === o.key;
          return (
            <label key={o.key} className={cn("flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-4", on ? "border-action bg-surface-raised ring-2 ring-action" : "border-border bg-surface", disabled && "cursor-not-allowed opacity-60")}>
              <input type="radio" name="plan" value={o.key} checked={on} disabled={disabled} onChange={() => setSel(o.key)} className="mt-1 size-5 accent-current" />
              <span className="flex flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="title-3 text-text">{o.name}{o.key === DEFAULT_KEY ? <span className="caption-3 ml-2 text-text-subtle">Pre selected</span> : null}</span>
                  <span className="text-text"><span className="title-2 tabular-nums">{money(o.usd)}</span> <span className="caption-2 text-text-subtle">{intervalText(o.interval)}</span></span>
                </span>
                <span className="body-6 text-text-subtle">{disabled ? "Sold out. The first 1,000 buyers have it." : o.note}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {error ? <Notice tone="danger" title="That did not go through">{error}</Notice> : null}

      <div className="flex flex-col gap-3">
        {p.signedIn ? (
          <Button size="lg" onClick={go} loading={busy} disabled={p.alreadyPaid}>Continue with {chosen.name}, {money(chosen.usd)}</Button>
        ) : (
          <ButtonLink size="lg" href={`/sign-in?next=${encodeURIComponent("/paywall")}`}>Sign in to continue</ButtonLink>
        )}
        <p className="body-6 text-text">{renews}</p>
        <p className="body-6 text-text-subtle">Full refund in the first {product.refundDays} days, one click in your account. Cancel any time in two taps.</p>
        <ButtonLink href={p.from} variant="tertiary">Not now</ButtonLink>
      </div>
    </main>
  );
}
