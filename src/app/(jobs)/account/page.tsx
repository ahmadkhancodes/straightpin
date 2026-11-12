import type { Metadata } from "next";
import { Container } from "@/components/ui/layout";
import { planById } from "@/config/product";
import { can } from "@/lib/auth/roles";
import { requireOrg } from "@/lib/auth/session";
import { effectivePlan } from "@/lib/billing/entitlement";
import { refundEligibility } from "@/lib/billing/lifecycle";
import { getStripe } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db";
import { AccountClient } from "./account-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AccountPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const ctx = await requireOrg({ page: true });
  const db = await getDb();
  const ent = await db.getEntitlement(ctx.org.id);
  const plan = effectivePlan(ent);
  const stripe = getStripe();
  const refund = stripe ? await refundEligibility(stripe, db, ctx.org.id).catch(() => null) : null;
  const price = planById(plan.id)?.prices.find((p) => p.interval === ent?.interval);
  return (
    <Container className="max-w-xl py-10 md:py-16">
      <h1 className="heading-3 text-text">Account</h1>
      <p className="body-4 mt-2 text-text-subtle">{ctx.user.email}</p>
      <AccountClient
        canManage={can(ctx.role, "billing", "manage")}
        planName={plan.name}
        isPaid={plan.id !== "free"}
        lifetime={ent?.status === "lifetime"}
        status={ent?.status ?? "none"}
        cancelAtPeriodEnd={!!ent?.cancelAtPeriodEnd}
        renewsAt={ent?.expiresAt ?? null}
        priceUsd={price?.usd ?? null}
        interval={ent?.interval ?? null}
        refund={refund ? { eligible: refund.eligible, reason: refund.reason, until: refund.until } : null}
        checkout={one(sp.checkout) === "success" ? "success" : one(sp.checkout) === "canceled" ? "canceled" : null}
      />
    </Container>
  );
}
