import type { Metadata } from "next";
import { product } from "@/config/product";
import { getOrgContext } from "@/lib/auth/session";
import { effectivePlan } from "@/lib/billing/entitlement";
import { getDb } from "@/lib/db";
import { safeFrom } from "@/lib/safe-from";
import { PaywallClient } from "./paywall-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose a plan", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const FREE = product.plans[0]!.limits;
const REASONS = {
  opens: { title: `You have used today's ${FREE.opens} free opens`, body: `Free plans open ${FREE.opens} jobs a day. The count resets at midnight UTC. You can keep browsing every title and company for free.` },
  saves: { title: "Your saved list is full", body: `Free plans keep ${FREE.saves} saved jobs. You can remove one, or pick a plan for unlimited saves.` },
  feature: { title: "That is part of a paid plan", body: "Everything you can see today stays free. This feature needs a plan." },
} as const;

export default async function PaywallPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const asked = one(sp.reason);
  const reason: keyof typeof REASONS = asked === "opens" || asked === "saves" ? asked : "feature";
  const from = safeFrom(one(sp.from));
  const ctx = await getOrgContext();
  const db = await getDb();
  const sold = await db.lifetimeSold();
  const paid = ctx ? effectivePlan(await db.getEntitlement(ctx.org.id)).id !== "free" : false;
  return (
    <PaywallClient
      title={REASONS[reason].title}
      body={REASONS[reason].body}
      from={from}
      signedIn={!!ctx}
      alreadyPaid={paid}
      lifetimeLeft={Math.max(0, product.lifetimeCap - sold)}
    />
  );
}
