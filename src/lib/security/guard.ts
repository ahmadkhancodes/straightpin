import { HttpError, json } from "@/lib/http";
import { appUrl } from "@/lib/env";
import { log } from "@/lib/logger";
import { enforceRateLimit, type Rule } from "./ratelimit";

/** Caller address as the platform reports it (first hop of x-forwarded-for). Bounded, never trusted for access. */
export function clientIp(req: Request): string {
  const first = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
  const ip = first || req.headers.get("x-real-ip")?.trim() || "unknown";
  return ip.slice(0, 64).replace(/[^0-9a-fA-F:.a-z-]/g, "") || "unknown";
}

/**
 * Per caller rate limit for a route. Keyed by `subject` (user or org id) when given, otherwise by IP.
 * If the limiter store itself is down the request goes through: a broken counter must not lock everyone out.
 */
export async function limitRequest(req: Request, name: string, rule: Rule, subject?: string): Promise<void> {
  try {
    await enforceRateLimit(`${name}:${subject ?? clientIp(req)}`, rule);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    log.warn("ratelimit_unavailable", { route: name, message: String((e as Error)?.message).slice(0, 120) });
  }
}

/** What each error code means to a person, and what to do next. Used by the /problem page. */
export const PROBLEMS: Record<string, { title: string; body: string }> = {
  rate_limited: { title: "That was a lot of clicks", body: "You are going faster than we allow. Wait a minute and try again. Nothing you did before was lost." },
  invalid_input: { title: "We could not read that form", body: "Something was missing or too long. Go back, check the fields and send it again." },
  not_found: { title: "That item is gone", body: "It was removed or never existed. Go back and refresh the page." },
  bad_origin: { title: "That request came from another site", body: "For your safety we only accept forms sent from this site. Open the page here and try again." },
  invalid_link: { title: "This link no longer works", body: "Use the link in your most recent email, or sign in and change the setting there." },
  account_suspended: { title: "This account is paused", body: "Write to contact@buffersoltech.com and we will look at it with you." },
  body_too_large: { title: "That was too much text", body: "Shorten it and send it again." },
  server_error: { title: "Something broke on our side", body: "Your data is safe. Wait a moment and try again. If it keeps happening, write to contact@buffersoltech.com." },
};

/** Send a failed plain-form post to a readable page instead of showing JSON. Only same-site `back` paths are kept. */
export function problemRedirect(code: string, back?: string): Response {
  const safeBack = back && /^\/[^/\\]/.test(back) ? back : "/";
  const key = code in PROBLEMS ? code : "server_error";
  return Response.redirect(`${appUrl()}/problem?${new URLSearchParams({ code: key, back: safeBack })}`, 303);
}

/** Error answer for a route: JSON for fetch callers (with Retry-After on 429), a readable page for form posts. */
export function failure(e: unknown, opts: { wantsJson: boolean; back?: string; route: string }): Response {
  const status = e instanceof HttpError ? e.status : 500;
  const code = e instanceof HttpError ? e.code : "server_error";
  if (!(e instanceof HttpError)) log.error("server_error", { route: opts.route, message: String((e as Error)?.message).slice(0, 160) });
  if (opts.wantsJson) return json({ error: code }, status, status === 429 ? { "retry-after": "60" } : {});
  return problemRedirect(code, opts.back);
}
