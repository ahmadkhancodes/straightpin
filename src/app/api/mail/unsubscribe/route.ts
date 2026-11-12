import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { limitRequest } from "@/lib/security/guard";
import { RULES } from "@/lib/security/ratelimit";
import { safeEqual } from "@/lib/ids";
import { unsubscribeToken } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function valid(url: URL) {
  const e = url.searchParams.get("e") ?? "";
  const s = url.searchParams.get("s") ?? "";
  const t = url.searchParams.get("t") ?? "";
  return e && s && t ? { e, s, t } : null;
}

async function apply(url: URL) {
  const p = valid(url);
  if (!p || !safeEqual(p.t, await unsubscribeToken(p.e, p.s))) return false;
  await (await getDb()).addSuppression({ email: p.e, scope: p.s, reason: "unsubscribe" });
  return true;
}

async function allowed(req: Request) {
  try { await limitRequest(req, "unsub", RULES.publicSigned); return true; } catch (e) { if (e instanceof HttpError) return false; throw e; }
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const page = (body: string, status: number) =>
  new Response(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Unsubscribe</title><body style="font-family:system-ui;max-width:560px;margin:64px auto;padding:0 16px"><main>${body}<p><a href="/">Back to the site</a></p></main></body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
const DONE = "<h1>You are unsubscribed</h1><p>You will not get these emails again. Sign-in emails still arrive.</p>";
const BAD = "<h1>This link is not valid</h1><p>Use the link from your most recent email.</p>";

/**
 * RFC 8058 one-click: mail clients POST `List-Unsubscribe=One-Click` to this URL. No CSRF check (signed token).
 * The confirm button on the GET page posts here too, with `confirm=1`, and gets a page back instead of plain text.
 */
export async function POST(req: Request) {
  if (!(await allowed(req))) return new Response("Too many requests", { status: 429, headers: { "retry-after": "60" } });
  const ok = await apply(new URL(req.url));
  const form = await req.formData().catch(() => null);
  if (form?.get("confirm") === "1") return page(ok ? DONE : BAD, ok ? 200 : 400);
  return new Response(ok ? "Unsubscribed" : "Invalid link", { status: ok ? 200 : 400 });
}

/** Humans get a confirm button. A GET never unsubscribes: mail scanners prefetch links (REVIEW P1-6). */
export async function GET(req: Request) {
  if (!(await allowed(req))) return page("<h1>Too many requests</h1><p>Wait a minute and open the link again.</p>", 429);
  const url = new URL(req.url);
  const p = valid(url);
  if (!p || !safeEqual(p.t, await unsubscribeToken(p.e, p.s))) return page(BAD, 400);
  return page(
    `<h1>Unsubscribe from these emails?</h1><p>${esc(p.e)} will stop getting them. Sign-in emails still arrive.</p><form method="post" action="${esc(url.pathname + url.search)}"><input type="hidden" name="confirm" value="1"><button type="submit" style="min-height:44px;padding:0 20px;font:inherit;font-weight:600;background:#121417;color:#fff;border:0;border-radius:4px;cursor:pointer">Yes, unsubscribe</button></form>`,
    200,
  );
}
