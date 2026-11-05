import { z } from "zod";
import { product } from "@/config/product";

// Typed env (ported from trayo server/env.ts). Never log values. Missing optional keys = stub mode.
const schema = z.object({
  NODE_ENV: z.string().default("development"),
  APP_NAME: z.string().default(product.slug),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  DB_DRIVER: z.enum(["mongo", "memory"]).optional(),
  MONGODB_URI: z.string().optional(),
  MONGODB_DB: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  MAIL_PROVIDER: z.enum(["resend", "console", "smtp", "none"]).optional(),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  ALTCHA_HMAC_KEY: z.string().optional(),
  APP_FLAGS: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return schema.parse(source);
}

export const env = (): Env => readEnv();
export const appName = (e: Env = env()) => e.APP_NAME;
export const appUrl = (e: Env = env()) =>
  (e.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, "");
export const isProd = () => process.env.NODE_ENV === "production";

/** DB driver: explicit DB_DRIVER, else mongo when MONGODB_URI is set, else memory (stub mode). */
export const dbDriver = (e: Env = env()) => e.DB_DRIVER ?? (e.MONGODB_URI ? "mongo" : "memory");

/** Flags from APP_FLAGS (string values only; bad JSON is ignored so /api/config never fails). Ported verbatim. */
export function envFlags(e: Pick<Env, "APP_FLAGS"> = env()): Record<string, string> {
  if (!e.APP_FLAGS) return {};
  try {
    const o = JSON.parse(e.APP_FLAGS) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  } catch {
    return {};
  }
}

export const adminEmails = (e: Env = env()) =>
  (e.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
