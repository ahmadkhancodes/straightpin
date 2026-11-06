import type Stripe from "stripe";

// Ported from trayo server/__tests__/fakes.ts (fakeStripe), adapted to Checkout Sessions and multi-tier plans.
type Sub = {
  id: string; customer: string; status: string; metadata: Record<string, string>;
  trial_start: number | null; trial_end: number | null; cancel_at_period_end: boolean;
  items: { data: { current_period_end: number; price: { lookup_key: string } }[] };
};

export function fakeStripe(nowSec = () => 1_800_000_000) {
  const prices = [
    { id: "price_weekly_w", lookup_key: "straightpin_weekly_week", currency: "usd", unit_amount: 499, recurring: { interval: "week" }, metadata: { app: "straightpin" } },
    { id: "price_monthly_m", lookup_key: "straightpin_monthly_month", currency: "usd", unit_amount: 1099, recurring: { interval: "month" }, metadata: { app: "straightpin" } },
    { id: "price_plus_m", lookup_key: "straightpin_plus_month", currency: "usd", unit_amount: 1999, recurring: { interval: "month" }, metadata: { app: "straightpin" } },
    { id: "price_plus_y", lookup_key: "straightpin_plus_year", currency: "usd", unit_amount: 9899, recurring: { interval: "year" }, metadata: { app: "straightpin" } },
    { id: "price_lifetime", lookup_key: "straightpin_lifetime_once", currency: "usd", unit_amount: 2399, recurring: null, metadata: { app: "straightpin" } },
    // Another app's price that must never be used (C-28): same lookup key shape, wrong metadata.
    { id: "price_other", lookup_key: "straightpin_monthly_month_x", currency: "usd", unit_amount: 999, recurring: { interval: "month" }, metadata: { app: "otherapp" } },
  ];
  const customers = new Map<string, { id: string; metadata: Record<string, string>; email?: string }>();
  const subs: Sub[] = [];
  const calls: { method: string; args: unknown }[] = [];
  type Charge = { id: string; customer: string; status: string; amount: number; amount_refunded: number; refunded: boolean; created: number; metadata: Record<string, string> };
  const charges: Charge[] = [];
  const refunds: { id: string; charge: string }[] = [];
  const failRefund = { on: false };
  let n = 0;

  const addSub = (customer: string, lookupKey: string, status = "active", extra: Partial<Sub> = {}) => {
    const now = nowSec();
    const s: Sub = {
      id: `sub_${++n}`, customer, status, metadata: { app: "straightpin" }, trial_start: null, trial_end: null,
      cancel_at_period_end: false, items: { data: [{ current_period_end: now + 30 * 86400, price: { lookup_key: lookupKey } }] }, ...extra,
    };
    subs.push(s);
    return s;
  };

  const addCharge = (customer: string, amount: number, createdSec = nowSec(), extra: Partial<Charge> = {}) => {
    const c: Charge = { id: `ch_${++n}`, customer, status: "succeeded", amount, amount_refunded: 0, refunded: false, created: createdSec, metadata: {}, ...extra };
    charges.unshift(c); // Stripe lists newest first
    return c;
  };

  const stripe = {
    charges: {
      list: async (p: { customer: string }) => ({ data: charges.filter((c) => c.customer === p.customer) }),
      retrieve: async (id: string) => charges.find((c) => c.id === id) ?? { id, customer: null },
    },
    refunds: {
      create: async (p: { charge: string }, o?: { idempotencyKey?: string }) => {
        calls.push({ method: "refunds.create", args: { ...p, ...o } });
        if (failRefund.on) throw new Error("stripe refused");
        const c = charges.find((x) => x.id === p.charge)!;
        c.amount_refunded = c.amount;
        c.refunded = true;
        const r = { id: `re_${++n}`, charge: p.charge };
        refunds.push(r);
        return r;
      },
    },
    prices: {
      list: async (p: { lookup_keys: string[] }) => ({ data: prices.filter((x) => p.lookup_keys.includes(x.lookup_key)) }),
    },
    customers: {
      create: async (p: { metadata: Record<string, string>; email?: string }) => {
        const c = { id: `cus_${++n}`, metadata: p.metadata, email: p.email };
        customers.set(c.id, c);
        return c;
      },
      retrieve: async (id: string) => customers.get(id) ?? { id, deleted: true },
      update: async (id: string, p: { metadata: Record<string, string> }) => {
        const c = customers.get(id)!;
        c.metadata = p.metadata;
        return c;
      },
    },
    checkout: {
      sessions: {
        create: async (p: unknown) => {
          calls.push({ method: "checkout.sessions.create", args: p });
          return { id: `cs_${++n}`, url: `https://checkout.stripe.test/cs_${n}` };
        },
      },
    },
    subscriptions: {
      list: async (p: { customer: string }) => ({ data: subs.filter((s) => s.customer === p.customer) }),
      retrieve: async (id: string) => {
        calls.push({ method: "subscriptions.retrieve", args: id });
        return subs.find((x) => x.id === id) ?? { id, customer: null };
      },
      update: async (id: string, p: { cancel_at_period_end?: boolean }) => {
        calls.push({ method: "subscriptions.update", args: { id, ...p } });
        const s = subs.find((x) => x.id === id)!;
        if (p.cancel_at_period_end !== undefined) s.cancel_at_period_end = p.cancel_at_period_end;
        return s;
      },
      cancel: async (id: string) => {
        calls.push({ method: "subscriptions.cancel", args: id });
        const s = subs.find((x) => x.id === id);
        if (s) s.status = "canceled";
        return s;
      },
    },
    billingPortal: {
      sessions: { create: async (p: { customer: string }) => ({ url: `https://billing.stripe.test/${p.customer}` }) },
    },
    webhooks: {
      constructEventAsync: async (body: string, sig: string) => {
        if (sig !== "good") throw new Error("bad signature");
        return JSON.parse(body);
      },
    },
  };
  return { stripe: stripe as unknown as Stripe, subs, customers, calls, addSub, addCharge, charges, refunds, failRefund };
}

let evt = 0;
export const event = (type: string, object: Record<string, unknown>, id = `evt_${++evt}`) => JSON.stringify({ id, type, data: { object } });
