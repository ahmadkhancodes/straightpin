"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/app/api";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { intervalText, product, type Interval } from "@/config/product";

interface Props {
  canManage: boolean;
  planName: string;
  isPaid: boolean;
  lifetime: boolean;
  status: string;
  cancelAtPeriodEnd: boolean;
  renewsAt: number | null;
  priceUsd: number | null;
  interval: Interval | null;
  refund: { eligible: boolean; reason: "ok" | "used" | "window" | "none"; until: number | null } | null;
  /** Back from Stripe Checkout: `success` or `canceled` (see /api/billing/checkout). */
  checkout: "success" | "canceled" | null;
}

/** After Checkout the webhook usually lands within seconds; check this many times, every POLL_MS, before saying "we will email you". */
export const POLL_TRIES = 10;
export const POLL_MS = 3000;

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
const day = (ms: number) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(ms));

type Step = "idle" | "confirm-cancel" | "confirm-refund" | "confirm-delete";

export function AccountClient(p: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"cancelled" | "refunded" | null>(null);
  const [polls, setPolls] = useState(0);
  const waiting = p.checkout === "success" && !p.isPaid;
  // Paid but the webhook has not arrived yet: refresh the server data a few times instead of showing Free as if nothing happened.
  useEffect(() => {
    if (!waiting || polls >= POLL_TRIES) return;
    const t = setTimeout(() => { setPolls((n) => n + 1); router.refresh(); }, POLL_MS);
    return () => clearTimeout(t);
  }, [waiting, polls, router]);

  async function call(kind: "cancel" | "refund" | "portal") {
    setBusy(kind);
    setError(null);
    const r = await api<{ url?: string }>(kind === "portal" ? "/api/billing/portal" : `/api/billing/${kind}`, { body: {} });
    setBusy(null);
    if (!r.ok) {
      setStep("idle");
      setError(r.code === "billing_unavailable" ? "Billing is not connected yet. Nothing was changed." : r.message);
      return;
    }
    if (kind === "portal" && r.data.url) {
      window.location.assign(r.data.url);
      return;
    }
    setStep("idle");
    setDone(kind === "cancel" ? "cancelled" : "refunded");
    router.refresh();
  }

  async function deleteAccount() {
    setBusy("delete");
    setError(null);
    const r = await api("/api/account", { method: "DELETE", body: { confirm: "delete my account" } });
    setBusy(null);
    if (!r.ok) {
      setStep("idle");
      setError(r.message);
      return;
    }
    router.push("/?deleted=1");
  }

  const cancelling = p.cancelAtPeriodEnd || done === "cancelled";
  const ended = done === "refunded";
  const renewText = p.lifetime
    ? "Lifetime: you pay once and never renew."
    : cancelling && p.renewsAt
      ? `Cancelled. You keep ${p.planName} until ${day(p.renewsAt)}, then move to Free.`
      : p.renewsAt && p.priceUsd !== null && p.interval
        ? `Renews on ${day(p.renewsAt)} for ${money(p.priceUsd)} ${intervalText(p.interval)}.`
        : p.renewsAt
          ? `Renews on ${day(p.renewsAt)}.`
          : "";

  return (
    <div className="mt-8 flex flex-col gap-6">
      {p.checkout === "success" && p.isPaid && !ended ? <Notice tone="success" title="Thanks, your plan is on">Every job opens now, and your saves have no limit.</Notice> : null}
      {waiting && polls < POLL_TRIES ? <Notice title="Turning your plan on">Thanks for paying. Stripe is confirming the payment, which usually takes a few seconds. This page updates by itself.</Notice> : null}
      {waiting && polls >= POLL_TRIES ? <Notice title="Your payment is still being confirmed">This is taking longer than usual. Reload this page in a few minutes. If you were charged and your plan is still Free after an hour, email {product.supportEmail} and we will sort it out.</Notice> : null}
      {p.checkout === "canceled" && !p.isPaid ? <Notice title="Checkout closed">Nothing was charged and you are still on Free. <Link href="/paywall?reason=feature&from=%2Faccount" className="text-action underline underline-offset-4">Pick a plan</Link> whenever you like.</Notice> : null}
      {done === "cancelled" ? <Notice tone="success" title="Your plan will not renew">Nothing more will be charged. You keep your plan until the date below.</Notice> : null}
      {ended ? <Notice tone="success" title="Refund issued">Your plan is off and the money is on its way back. We sent you a confirmation email. Refunds usually reach your card in 5 to 10 business days.</Notice> : null}
      {error ? <Notice tone="danger" title="That did not go through">{error}</Notice> : null}
      {!p.canManage ? <Notice title="Read only">Only the account owner can change the plan or payment method.</Notice> : null}

      <section aria-labelledby="plan-h" className="border border-border bg-surface p-4 sm:p-6">
        <h2 id="plan-h" className="caption-3 text-text-subtle">Your plan</h2>
        <p className="heading-4 mt-1 text-text" data-testid="plan-name">{ended ? "Free" : p.planName}</p>
        {!ended && renewText ? <p className="body-5 mt-2 text-text-subtle" data-testid="renew-text">{renewText}</p> : null}
        {!p.isPaid || ended ? (
          <div className="mt-4"><ButtonLink href="/paywall?reason=feature&from=%2Faccount" size="lg" className="w-full sm:w-auto">See plans</ButtonLink></div>
        ) : null}
      </section>

      {p.isPaid && !ended && p.canManage ? (
        <section aria-labelledby="manage-h" className="flex flex-col gap-4 border border-border bg-surface p-4 sm:p-6">
          <h2 id="manage-h" className="title-2 text-text">Manage</h2>

          {!p.lifetime ? (
            <div className="flex flex-col gap-3">
              <Button variant="secondary" onClick={() => call("portal")} loading={busy === "portal"} className="w-full sm:w-auto">Change card or see invoices</Button>
              {!cancelling && step !== "confirm-cancel" ? (
                <Button variant="tertiary" onClick={() => setStep("confirm-cancel")} className="w-full sm:w-auto">Cancel plan</Button>
              ) : null}
              {step === "confirm-cancel" ? (
                <div role="group" aria-label="Confirm cancel" className="flex flex-col gap-3 rounded-md border border-border-strong p-4">
                  <p className="body-5 text-text">Cancel {p.planName}? You keep it until {p.renewsAt ? day(p.renewsAt) : "the end of the period"}. It will not renew.</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="danger" onClick={() => call("cancel")} loading={busy === "cancel"}>Yes, cancel my plan</Button>
                    <Button variant="secondary" onClick={() => setStep("idle")}>Keep my plan</Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {p.refund?.eligible ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="body-6 text-text-subtle">Not for you? Get a full refund of your first payment until {p.refund.until ? day(p.refund.until) : `${product.refundDays} days after you paid`}. Your plan turns off right away. One refund per customer, for your first payment only.</p>
              {step !== "confirm-refund" ? (
                <Button variant="secondary" onClick={() => setStep("confirm-refund")} className="w-full sm:w-auto">Refund my first payment</Button>
              ) : (
                <div role="group" aria-label="Confirm refund" className="flex flex-col gap-3 rounded-md border border-border-strong p-4">
                  <p className="body-5 text-text">Refund your first payment and turn off {p.planName} now?</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="danger" onClick={() => call("refund")} loading={busy === "refund"}>Yes, refund me</Button>
                    <Button variant="secondary" onClick={() => setStep("idle")}>Keep my plan</Button>
                  </div>
                </div>
              )}
            </div>
          ) : p.refund?.reason === "used" ? (
            <p className="body-6 border-t border-border pt-4 text-text-subtle">You have used your one refund.</p>
          ) : p.refund?.reason === "window" ? (
            <p className="body-6 border-t border-border pt-4 text-text-subtle">The {product.refundDays} day refund window for your first payment has closed. <Link href="/legal/refunds" className="text-action underline underline-offset-4">Refund policy</Link></p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="data-h" className="flex flex-col gap-4 border border-border bg-surface p-4 sm:p-6">
        <h2 id="data-h" className="title-2 text-text">Your data</h2>
        <p className="body-6 text-text-subtle">Download everything we hold about you as one JSON file: your answers, saved jobs, alerts and billing records. Or delete your account. Deleting cancels any paid plan, removes your answers, saved jobs and alerts, and cannot be undone. Billing records we must keep for tax stay with our payment provider.</p>
        <div className="flex flex-col gap-3">
          <ButtonLink href="/api/account/export" variant="secondary" className="w-full sm:w-auto">Download my data</ButtonLink>
          {step !== "confirm-delete" ? (
            <Button variant="tertiary" onClick={() => setStep("confirm-delete")} className="w-full sm:w-auto">Delete my account</Button>
          ) : (
            <div role="group" aria-label="Confirm delete" className="flex flex-col gap-3 rounded-md border border-border-strong p-4">
              <p className="body-5 text-text">Delete your account and everything in it? This cannot be undone.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="danger" onClick={deleteAccount} loading={busy === "delete"}>Yes, delete my account</Button>
                <Button variant="secondary" onClick={() => setStep("idle")}>Keep my account</Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
