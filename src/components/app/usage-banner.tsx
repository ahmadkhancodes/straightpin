import Link from "next/link";
import { Notice } from "@/components/ui/states";
import type { Entitlement } from "@/lib/db/types";
import type { UsageState } from "@/lib/billing/usage";
import { product } from "@/config/product";
import { METER_LABELS, fmt } from "./labels";

/** Shown in the app layout when a meter is near/over its limit, or a payment failed. */
export function UsageBanner({ usage, entitlement }: { usage: UsageState[]; entitlement: Entitlement | null }) {
  const worst = [...usage].filter((u) => u.level !== "ok").sort((a, b) => b.ratio - a.ratio)[0];
  const pastDue = entitlement?.status === "past_due";
  if (!worst && !pastDue) return null;
  const link = (label: string) => (
    <Link href="/app/billing" className="button-sm inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-3 py-2 text-text transition-colors duration-300 hover:bg-surface-raised focus-visible:focus-ring">
      {label}
    </Link>
  );
  return (
    <div className="flex flex-col gap-2">
      {pastDue ? (
        <Notice tone="warning" title="Your last payment failed" action={link("Update payment")}>
          Your plan stays active for {product.graceDays} days while we retry. Update your payment method to avoid falling back to Free.
        </Notice>
      ) : null}
      {worst ? (
        <Notice
          tone={worst.level === "over" ? "danger" : "warning"}
          title={worst.level === "over" ? "You are over your limit" : "You are close to your limit"}
          action={link("Upgrade")}
        >
          You have used {fmt(worst.used)} of {fmt(worst.limit)} {METER_LABELS[worst.meter].plural}
          {METER_LABELS[worst.meter].period ? ` ${METER_LABELS[worst.meter].period}` : ""}.
          {worst.meter === "submissions" ? " Over-limit submissions are held, not dropped." : ""}
        </Notice>
      ) : null}
    </div>
  );
}
