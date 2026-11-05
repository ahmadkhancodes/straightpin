import { emitEvent } from "@/lib/webhooks/outbound";
import { handleStripeWebhook } from "@/lib/billing/webhook";
import { getStripe } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { json } from "@/lib/http";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe webhook: signature on the RAW body (req.text(), never req.json()). Exempt from CSRF (signed). */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return json({ error: "billing_unavailable" }, 503);
  try {
    const db = await getDb();
    return await handleStripeWebhook(await req.text(), req.headers.get("stripe-signature"), {
      stripe,
      db,
      secret,
      onChange: async (orgId, type) => {
        const ent = await db.getEntitlement(orgId);
        await emitEvent(orgId, "billing.updated", { stripeEvent: type, plan: ent?.plan, status: ent?.status }, { db }).catch(() => []);
      },
    });
  } catch (e) {
    // 500 => Stripe retries; the event was NOT recorded, so the retry reprocesses it.
    log.error("stripe_webhook_failed", { message: (e as Error).message });
    return json({ error: "server_error" }, 500);
  }
}
