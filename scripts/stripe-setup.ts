/**
 * Idempotent Stripe catalogue setup from src/config/product.ts (ported from trayo scripts/stripe-setup.ts).
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe-setup.ts
 * Creates only what is missing. Matches by metadata.app=<slug> and lookup_key. Refuses to touch other apps' objects.
 */
import { product } from "../src/config/product";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error("Set STRIPE_SECRET_KEY");
  process.exit(1);
}
const APP = product.slug;
type Dict = Record<string, unknown>;

function form(obj: Dict, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === "object") form(v as Dict, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(method: "GET" | "POST", path: string, params: Dict = {}): Promise<Dict> {
  const body = form(params);
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" ? `?${body}` : ""}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? body : undefined,
  });
  const json = (await res.json()) as Dict;
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  const found = (await stripe("GET", "products/search", { query: `metadata['app']:'${APP}'`, limit: 100 })).data as Dict[];
  for (const plan of product.plans) {
    if (plan.prices.length === 0) continue;
    const name = `${product.name} · ${plan.name}`;
    let productId = (found.find((x) => x.name === name)?.id as string | undefined) ?? null;
    if (productId) console.log(`product exists  ${name} ${productId}`);
    else {
      const created = await stripe("POST", "products", {
        name,
        description: `${product.fullName} ${plan.name} plan`,
        statement_descriptor: `BUFFERSOL ${product.name.toUpperCase()}`.slice(0, 22),
        metadata: { app: APP, plan: plan.id },
      });
      productId = created.id as string;
      console.log(`product created ${name} ${productId}`);
    }
    for (const pr of plan.prices) {
      const existing = ((await stripe("GET", "prices", { "lookup_keys[]": pr.lookupKey, limit: 1 })).data as Dict[])[0];
      if (existing) {
        if ((existing.metadata as Dict).app !== APP) throw new Error(`lookup_key ${pr.lookupKey} belongs to another app: refusing`);
        console.log(`price exists    ${pr.lookupKey} ${existing.id}`);
        continue;
      }
      const created = await stripe("POST", "prices", {
        product: productId,
        currency: product.currency,
        unit_amount: pr.usd,
        nickname: `${product.name} ${plan.name} ${pr.interval === "year" ? "annual" : "monthly"}`,
        lookup_key: pr.lookupKey,
        recurring: { interval: pr.interval },
        tax_behavior: "exclusive",
        metadata: { app: APP, plan: plan.id, interval: pr.interval },
      });
      console.log(`price created   ${pr.lookupKey} ${created.id}`);
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
