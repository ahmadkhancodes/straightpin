import { z } from "zod";
import { getOrgContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { assertSameOrigin, HttpError, json } from "@/lib/http";
import { parseAnswers, quizSchema } from "@/lib/jobs/matching";
import type { SearchProfile } from "@/lib/jobs/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = { US: "America/New_York", CA: "America/Toronto", UK: "Europe/London" } as const;
const settingsSchema = z.object({ digest: z.boolean().optional(), alerts: z.boolean().optional(), tz: z.string().max(64).optional() });

/** Saves the quiz answers and delivery settings for the signed in user (JSON or a plain HTML form post). */
async function save(answers: z.infer<typeof quizSchema>, settings: z.infer<typeof settingsSchema>) {
  const ctx = await getOrgContext();
  if (!ctx) throw new HttpError(401, "unauthorized");
  const db = await getDb();
  const prev = await db.getProfile(ctx.org.id);
  const now = new Date();
  const profile: SearchProfile = {
    orgId: ctx.org.id,
    email: ctx.user.email,
    ...answers,
    tz: settings.tz ?? prev?.tz ?? TZ[answers.country],
    digest: settings.digest ?? prev?.digest ?? true,
    alerts: settings.alerts ?? prev?.alerts ?? true,
    lastDigestAt: prev?.lastDigestAt ?? null,
    lastAlertAt: prev?.lastAlertAt ?? null,
    updatedAt: now,
  };
  await db.saveProfile(profile);
  // Turning a mail type back on lifts the earlier one click unsubscribe for it.
  if (settings.digest) await db.removeSuppression(ctx.user.email, "digest");
  if (settings.alerts) await db.removeSuppression(ctx.user.email, "alerts");
  return profile;
}

export async function POST(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  try {
    assertSameOrigin(req);
    if (type.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const a = quizSchema.safeParse(body);
      if (!a.success) throw new HttpError(400, "invalid_input");
      const profile = await save(a.data, settingsSchema.parse(body));
      return json({ ok: true, profile });
    }
    // Plain form post (works without JS): answers + optional settings, then back to the matches.
    const form = await req.formData().catch(() => new FormData());
    const a = parseAnswers((k) => (form.get(k) as string | null) ?? undefined);
    if (!a) return Response.redirect(`${appUrl()}/quiz`, 303);
    const onoff = (k: string) => (form.get(k) === "on" ? true : form.get(k) === "off" ? false : undefined);
    await save(a, { digest: onoff("digest"), alerts: onoff("alerts") });
    // The email settings form (it sends `digest`) goes back to its own page, so "Off" is never answered with "your email is on".
    return Response.redirect(`${appUrl()}${form.has("digest") ? "/alerts?settings=saved" : "/matches?saved=1"}`, 303);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401 && !type.includes("application/json")) return Response.redirect(`${appUrl()}/sign-in?next=${encodeURIComponent("/quiz")}`, 303);
    if (e instanceof HttpError) return json({ error: e.code }, e.status);
    return json({ error: "invalid_input" }, 400);
  }
}
