import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic gate only: a cheap cookie-presence check, never a DB call (Next 16 proxy).
 * Real authorization happens in the server components via requireOrg().
 */
/** A path with a broken percent escape (`/job/%E0%A4%A`) makes Next answer 500 on dynamic routes. It is a bad request, not a server fault. */
export const hasBrokenEscape = (path: string) => /%(?![0-9a-fA-F]{2})/.test(path);

/**
 * Readable presence hint for the marketing header ("Account" instead of "Log in"). It holds no secret, only
 * whether a session cookie exists, so the header never has to call the rate limited session endpoint.
 */
export const SIGNED_IN_HINT = "sp_in";
const hasSessionCookie = (request: NextRequest) => request.cookies.getAll().some((c) => c.name.endsWith(".session_token"));

export function syncSignedInHint(request: NextRequest, response: NextResponse): NextResponse {
  const signedIn = hasSessionCookie(request);
  const hinted = request.cookies.get(SIGNED_IN_HINT)?.value === "1";
  if (signedIn && !hinted) response.cookies.set(SIGNED_IN_HINT, "1", { path: "/", sameSite: "lax", secure: request.nextUrl.protocol === "https:", maxAge: 60 * 60 * 24 * 30 });
  if (!signedIn && hinted) response.cookies.delete(SIGNED_IN_HINT);
  return response;
}

export function proxy(request: NextRequest) {
  const raw = request.url.slice(request.url.indexOf("/", request.url.indexOf("//") + 2));
  if (hasBrokenEscape(raw.split("?")[0]!)) return new NextResponse("Bad request: the address has a broken % escape.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (!/^\/(app|admin)(\/|$)/.test(request.nextUrl.pathname)) return syncSignedInHint(request, NextResponse.next());
  if (hasSessionCookie(request)) return syncSignedInHint(request, NextResponse.next());
  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/sign-in";
  url.search = "";
  url.searchParams.set("next", next);
  return syncSignedInHint(request, NextResponse.redirect(url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
