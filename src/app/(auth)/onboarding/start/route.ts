import { cookies } from "next/headers";
import { safeNext, slugify } from "@/components/app/redirect";
import { getAuth } from "@/lib/auth";
import { getOrgContext, getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { ANSWERS_COOKIE, answersFromCookie } from "@/lib/jobs/matching";
import type { SearchProfile } from "@/lib/jobs/types";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Name of the personal account a job seeker gets without being asked. Renamable in Settings. */
const PERSONAL_ACCOUNT_NAME = "My job search";
const TZ = { US: "America/New_York", CA: "America/Toronto", UK: "Europe/London" } as const;

const go = (path: string) => Response.redirect(`${appUrl()}${path}`, 303);

/**
 * First sign-in: a job seeker should not have to "name an organization" (QA-REPORT open item). This creates the one
 * personal account (D-057: one per person), stores the quiz answers they already gave (the `sp_q` cookie) as their
 * search profile, and sends them on. A failure falls back to the manual form.
 * GET is safe to repeat: with an account already there it only redirects; a forged visit can only set up the
 * visitor's own account, which their next sign-in would do anyway.
 */
export async function GET(req: Request) {
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const session = await getSession(req.headers);
  if (!session) return go(`/sign-in?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(next)}`)}`);
  if (!(await getOrgContext(req.headers))) {
    const name = session.user.name?.trim().length >= 2 ? session.user.name.trim().slice(0, 60) : PERSONAL_ACCOUNT_NAME;
    try {
      const auth = await getAuth();
      await auth.api.createOrganization({ headers: req.headers, body: { name, slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 8)}` } });
    } catch (e) {
      // A double tap can race the one-per-person limit; if the account exists now, carry on.
      if (!(await getOrgContext(req.headers))) {
        log.warn("onboarding_auto_failed", { route: "/onboarding/start", reason: e instanceof Error ? e.name : "unknown" });
        return go(`/onboarding?manual=1&next=${encodeURIComponent(next)}`);
      }
    }
  }
  const ctx = await getOrgContext(req.headers);
  const answers = answersFromCookie((await cookies()).get(ANSWERS_COOKIE)?.value);
  if (ctx && answers) {
    const db = await getDb();
    if (!(await db.getProfile(ctx.org.id))) {
      const profile: SearchProfile = {
        orgId: ctx.org.id, email: ctx.user.email, ...answers, tz: TZ[answers.country],
        // The daily email only when they signed up from the matches page, whose link promises it; otherwise they choose in Alerts.
        digest: next.startsWith("/matches"), alerts: true, lastDigestAt: null, lastAlertAt: null, updatedAt: new Date(),
      };
      await db.saveProfile(profile);
    }
  }
  return go(next);
}
