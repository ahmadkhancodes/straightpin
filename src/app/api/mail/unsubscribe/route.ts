import { getDb } from "@/lib/db";
import { safeEqual } from "@/lib/ids";
import { unsubscribeToken } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function apply(url: URL) {
  const e = url.searchParams.get("e") ?? "";
  const s = url.searchParams.get("s") ?? "";
  const t = url.searchParams.get("t") ?? "";
  if (!e || !s || !t || !safeEqual(t, await unsubscribeToken(e, s))) return false;
  await (await getDb()).addSuppression({ email: e, scope: s, reason: "unsubscribe" });
  return true;
}

/** RFC 8058 one-click: mail clients POST `List-Unsubscribe=One-Click` to this URL. No CSRF check (signed token). */
export async function POST(req: Request) {
  const ok = await apply(new URL(req.url));
  return new Response(ok ? "Unsubscribed" : "Invalid link", { status: ok ? 200 : 400 });
}

/** Humans clicking the link get a confirmation page. */
export async function GET(req: Request) {
  const ok = await apply(new URL(req.url));
  const body = ok
    ? "<h1>You are unsubscribed</h1><p>You will not get these emails again. Sign-in emails still arrive.</p>"
    : "<h1>This link is not valid</h1><p>Use the link from your most recent email.</p>";
  return new Response(`<!doctype html><meta name="viewport" content="width=device-width"><title>Unsubscribe</title><body style="font-family:system-ui;max-width:560px;margin:64px auto;padding:0 16px">${body}<p><a href="/">Back to the site</a></p></body>`, {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
