import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { UsageBanner } from "@/components/app/usage-banner";
import { METERS_SHOWN } from "@/components/app/labels";
import { product } from "@/config/product";
import { isFounderAdmin, requireOrg } from "@/lib/auth/session";
import { currentUsage } from "@/lib/billing/usage";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrg({ page: true });
  const db = await getDb();
  const [ent, usage] = await Promise.all([db.getEntitlement(ctx.org.id), currentUsage(db, ctx.org.id, METERS_SHOWN)]);
  return (
    <AppShell
      org={{ id: ctx.org.id, name: ctx.org.name }}
      user={{ name: ctx.user.name, email: ctx.user.email }}
      isAdmin={isFounderAdmin(ctx.user.email)}
      productName={product.name}
      banners={<UsageBanner usage={usage} entitlement={ent} />}
    >
      {children}
    </AppShell>
  );
}
