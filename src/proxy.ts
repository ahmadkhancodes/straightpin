import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic gate only: a cheap cookie-presence check, never a DB call (Next 16 proxy).
 * Real authorization happens in the server components via requireOrg().
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.getAll().some((c) => c.name.endsWith(".session_token"));
  if (hasSession) return NextResponse.next();
  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/sign-in";
  url.search = "";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
