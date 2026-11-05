import { z } from "zod";
import { log } from "./logger";
import { appUrl } from "./env";

// Ported from trayo server/lib/http.ts (HttpError, json, readJson) + withApi() wrapper.
// Changes for cookie web: no CORS *, `cache-control: no-store`, Origin/CSRF check on non-GET.

export class HttpError extends Error {
  constructor(public status: number, public code: string, public details?: unknown) {
    super(code);
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}

export const MAX_BODY = 1_000_000; // jotflow improvement (3)

export async function readJson<T>(req: Request, schema?: z.ZodType<T>): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) throw new HttpError(413, "body_too_large");
  let data: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) throw new HttpError(413, "body_too_large");
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "bad_json");
  }
  if (!schema) return data as T;
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, "invalid_input", r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  return r.data;
}

/** Allowed origins for state-changing cookie requests. */
export function allowedOrigins(): string[] {
  const list = [appUrl()];
  if (process.env.VERCEL_URL) list.push(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_BRANCH_URL) list.push(`https://${process.env.VERCEL_BRANCH_URL}`);
  if (process.env.NODE_ENV !== "production") list.push("http://localhost:3000", "http://127.0.0.1:3000");
  return list;
}

/**
 * CSRF guard for cookie-authenticated, state-changing requests (BACKEND_REUSE 1.3):
 * Origin (or Referer) must be ours. Requests with a Bearer/x-api-key header are not cookie-driven and pass.
 */
export function assertSameOrigin(req: Request, origins = allowedOrigins()): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  if (req.headers.get("authorization")?.startsWith("Bearer ") || req.headers.get("x-api-key")) return;
  const origin = req.headers.get("origin") ?? (() => {
    const ref = req.headers.get("referer");
    try { return ref ? new URL(ref).origin : null; } catch { return null; }
  })();
  const self = new URL(req.url).origin;
  if (!origin || !(origin === self || origins.includes(origin))) throw new HttpError(403, "bad_origin");
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: CSRF check (unless `csrf: false`), HttpError -> {error: code}, unknown -> 500 server_error. */
export function withApi<C = unknown>(handler: Handler<C>, opts: { csrf?: boolean; route?: string } = {}): Handler<C> {
  return async (req, ctx) => {
    try {
      if (opts.csrf !== false) assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, ...(e.details ? { details: e.details } : {}) }, e.status);
      log.error("server_error", { route: opts.route ?? new URL(req.url).pathname, message: (e as Error)?.message });
      return json({ error: "server_error" }, 500);
    }
  };
}

/** Client IP from Vercel/proxy headers. */
export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0").slice(0, 64);
}
