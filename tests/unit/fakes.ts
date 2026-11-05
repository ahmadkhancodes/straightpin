import type Stripe from "stripe";

// Ported from trayo server/__tests__/fakes.ts (fakeStripe), adapted to Checkout Sessions and multi-tier plans.
type Sub = {
  id: string; customer: string; status: string; metadata: Record<string, string>;
  trial_start: number | null; trial_end: number | null; cancel_at_period_end: boolean;
  items: { data: { current_period_end: number; price: { lookup_key: string } }[] };
};

export function fakeStripe(nowSec = () => 1_800_000_000) {
  const prices = [
    { id: "price_starter_y", lookup_key: "postslot_starter_annual", currency: "usd", unit_amount: 2400, recurring: { interval: "year" }, metadata: { app: "postslot" } },
    { id: "price_pro_m", lookup_key: "postslot_pro_monthly", currency: "usd", unit_amount: 749, recurring: { interval: "month" }, metadata: { app: "postslot" } },
    { id: "price_pro_y", lookup_key: "postslot_pro_annual", currency: "usd", unit_amount: 7400, recurring: { interval: "year" }, metadata: { app: "postslot" } },
    { id: "price_agency_m", lookup_key: "postslot_agency_monthly", currency: "usd", unit_amount: 1949, recurring: { interval: "month" }, metadata: { app: "postslot" } },
    { id: "price_agency_y", lookup_key: "postslot_agency_annual", currency: "usd", unit_amount: 19900, recurring: { interval: "year" }, metadata: { app: "postslot" } },
    // Another app's price that must never be used (C-28): same lookup key shape, wrong metadata.
    { id: "price_other", lookup_key: "postslot_pro_monthly_x", currency: "usd", unit_amount: 999, recurring: { interval: "month" }, metadata: { app: "otherapp" } },
  ];
  const customers = new Map<string, { id: string; metadata: Record<string, string>; email?: string }>();
  const subs: Sub[] = [];
  const calls: { method: string; args: unknown }[] = [];
  let n = 0;

  const addSub = (customer: string, lookupKey: string, status = "active", extra: Partial<Sub> = {}) => {
    const now = nowSec();
    const s: Sub = {
      id: `sub_${++n}`, customer, status, metadata: { app: "postslot" }, trial_start: null, trial_end: null,
      cancel_at_period_end: false, items: { data: [{ current_period_end: now + 30 * 86400, price: { lookup_key: lookupKey } }] }, ...extra,
    };
    subs.push(s);
    return s;
  };

  const stripe = {
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
  return { stripe: stripe as unknown as Stripe, subs, customers, calls, addSub };
}

let evt = 0;
export const event = (type: string, object: Record<string, unknown>, id = `evt_${++evt}`) => JSON.stringify({ id, type, data: { object } });
