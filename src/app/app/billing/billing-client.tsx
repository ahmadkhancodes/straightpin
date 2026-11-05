"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/app/api";
import { Meter } from "@/components/app/meter";
import { Panel } from "@/components/app/page-header";
import { formatDate } from "@/components/app/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Badge, Notice } from "@/components/ui/states";
import { planById, product, type Interval, type Plan, type PlanId } from "@/config/product";
import type { UsageState } from "@/lib/billing/usage";

interface Props {
  canManage: boolean;
  planId: PlanId;
  status: string;
  isPaid: boolean;
  interval: Interval | null;
  renewsAt: number | null;
  cancelAtPeriodEnd: boolean;
  usage: UsageState[];
  preselect: { plan: PlanId; interval: Interval } | null;
  returnedSession: string | null;
}

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

const STATUS: Record<string, { label: string; tone: "info" | "success" | "warning" | "danger" }> = {
  none: { label: "Free", tone: "info" },
  trialing: { label: "Trial", tone: "success" },
  active: { label: "Active", tone: "success" },
  past_due: { label: "Payment failed", tone: "warning" },
  canceled: { label: "Canceled", tone: "danger" },
  lifetime: { label: "Lifetime", tone: "success" },
};

export function BillingClient(p: Props) {
  const [interval, setInterval] = useState<Interval>(p.preselect?.interval ?? p.interval ?? product.defaultInterval);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [verifying, setVerifying] = useState(!!p.returnedSession);
  const [activated, setActivated] = useState<string | null>(null);
  const [live, setLive] = useState({ planId: p.planId, usage: p.usage });

  useEffect(() => {
    if (!p.returnedSession) return;
    let alive = true;
    api<{ plan: { id: string; name: string }; usage: UsageState[] }>("/api/billing/entitlement?refresh=1").then((r) => {
      if (!alive) return;
      setVerifying(false);
      if (r.ok) {
        setActivated(r.data.plan.name);
        setLive({ planId: r.data.plan.id as PlanId, usage: r.data.usage ?? p.usage });
      } else setError({ code: r.code, message: r.message });
    });
    return () => { alive = false; };
  }, [p.returnedSession, p.usage]);

  const plan = planById(live.planId) ?? product.plans[0]!;
  const status = STATUS[p.status] ?? STATUS.none!;

  async function checkout(target: Plan) {
    setBusy(target.id);
    setError(null);
    const price = target.prices.find((x) => x.interval === interval) ?? target.prices[0];
    const r = await api<{ url: string }>("/api/billing/checkout", { body: { plan: target.id, interval: price?.interval ?? interval } });
    if (r.ok && r.data.url) {
      window.location.assign(r.data.url);
      return;
    }
    setBusy(null);
    if (!r.ok) setError({ code: r.code, message: r.message });
  }

  async function portal() {
    setBusy("portal");
    setError(null);
    const r = await api<{ url: string }>("/api/billing/portal", { body: {} });
    if (r.ok && r.data.url) {
      window.location.assign(r.data.url);
      return;
    }
    setBusy(null);
    if (!r.ok) setError({ code: r.code, message: r.message });
  }

  const pre = p.preselect ? planById(p.preselect.plan) : undefined;

  return (
    <div className="flex flex-col gap-6">
      {verifying ? <Notice title="Confirming your payment">This takes a few seconds.</Notice> : null}
      {activated ? <Notice tone="success" title="Your plan is active">You are now on {activated}. A receipt is on its way to your email.</Notice> : null}
      {error ? (
        <Notice tone={error.code === "billing_unavailable" ? "info" : "danger"} title={error.code === "billing_unavailable" ? "Billing is not connected yet" : "That did not go through"}>
          {error.code === "billing_unavailable" ? "Plans can be chosen here once payments are switched on. Nothing was charged." : error.message}
        </Notice>
      ) : null}
      {!p.canManage ? <Notice title="Read only">Only organization owners can change the plan or payment method. Ask an owner if you need an upgrade.</Notice> : null}
      {pre && p.canManage && !p.isPaid && !activated ? (
        <Notice
          title={`Continue with ${pre.name}`}
          action={<Button onClick={() => checkout(pre)} loading={busy === pre.id}>Continue to checkout</Button>}
        >
          You picked {pre.name} billed {p.preselect?.interval === "month" ? "monthly" : "yearly"} on the pricing page.
        </Notice>
      ) : null}

      <Panel
        title="Current plan"
        actions={p.isPaid && p.canManage ? <Button variant="secondary" onClick={portal} loading={busy === "portal"}>Manage billing</Button> : undefined}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <dl className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <dt className="sr-only">Plan</dt>
              <dd className="heading-5 text-text">{plan.name}</dd>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <div>
              <dt className="caption-4 text-text-muted">{p.cancelAtPeriodEnd ? "Ends on" : "Renews on"}</dt>
              <dd className="body-5 text-text tabular-nums">
                {p.isPaid && p.renewsAt ? formatDate(p.renewsAt) : "No renewal, the Free plan has no billing date"}
              </dd>
            </div>
            {p.cancelAtPeriodEnd ? <p className="body-6 text-text-subtle">Your subscription is set to cancel. You keep {plan.name} until that date, then move to Free.</p> : null}
          </dl>
          <div className="flex flex-col gap-4">
            {live.usage.map((u) => <Meter key={u.meter} state={u} />)}
          </div>
        </div>
      </Panel>

      <section aria-labelledby="plans-h" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="plans-h" className="title-2 text-text">Plans</h2>
          <div role="group" aria-label="Billing interval" className="inline-flex rounded-md border border-border-strong p-1">
            {(["month", "year"] as const).map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={interval === i}
                onClick={() => setInterval(i)}
                className={cn(
                  "button-sm min-h-8 rounded-sm px-3 py-1 transition-colors duration-300 focus-visible:focus-ring",
                  interval === i ? "bg-action text-action-text" : "text-text-subtle hover:text-text",
                )}
              >
                {i === "month" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {product.plans.map((pl) => {
            const price = pl.prices.find((x) => x.interval === interval) ?? pl.prices[0];
            const current = pl.id === live.planId;
            const chosen = p.preselect?.plan === pl.id;
            return (
              <article
                key={pl.id}
                aria-label={pl.name}
                className={cn("flex flex-col gap-4 rounded-lg border bg-surface p-4", current || chosen ? "border-action" : "border-border")}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="title-3 text-text">{pl.name}</h3>
                  {current ? <Badge tone="success">Current</Badge> : null}
                </div>
                <p className="body-6 text-text-subtle">{pl.tagline}</p>
                <p className="text-text">
                  <span className="heading-5 tabular-nums">{price ? money(price.usd) : "$0"}</span>
                  <span className="caption-2 text-text-subtle"> {price ? `per ${price.interval}` : "forever"}</span>
                </p>
                {price && price.interval !== interval ? <p className="caption-2 text-text-muted">Billed {price.interval === "year" ? "yearly" : "monthly"} only.</p> : null}
                <ul className="flex flex-1 flex-col gap-1">
                  {pl.highlights.map((h) => <li key={h} className="body-6 text-text-subtle">{h}</li>)}
                </ul>
                {pl.prices.length === 0 ? null : current ? (
                  <Button variant="secondary" disabled>Current plan</Button>
                ) : p.isPaid ? (
                  <Button variant="secondary" onClick={portal} loading={busy === "portal"} disabled={!p.canManage}>Change in billing portal</Button>
                ) : (
                  <Button onClick={() => checkout(pl)} loading={busy === pl.id} disabled={!p.canManage || !!busy}>{pl.cta}</Button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
