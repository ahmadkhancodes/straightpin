import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { refundLatestCharge } from "@/lib/billing/lifecycle";
import { requireStripe } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { assertSameOrigin, HttpError, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Form = z.object({ orgId: z.string().min(1).max(200), email: z.string().max(320), action: z.enum(["suspend", "unsuspend", "refund"]) });

/** Founder actions on one account: suspend, unsuspend, refund (window waived, still once per customer). All audited. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const admin = await requireAdmin();
    const f = Form.safeParse(Object.fromEntries(await req.formData()));
    if (!f.success) throw new HttpError(400, "invalid_input");
    const { orgId, email, action } = f.data;
    const db = await getDb();
    let note = action;
    if (action === "refund") {
      await refundLatestCharge({ stripe: requireStripe(), db }, orgId, { id: admin.id, by: "admin" });
      note = "refund";
    } else {
      await db.setSuspended(orgId, action === "suspend", admin.email);
      await audit({ orgId, actorId: admin.id, action: action === "suspend" ? "admin.suspended" : "admin.unsuspended" });
    }
    return Response.redirect(`${appUrl()}/admin/users?${new URLSearchParams({ email, done: note })}`, 303);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status);
    throw e;
  }
}
