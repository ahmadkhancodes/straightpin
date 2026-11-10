import { product } from "@/config/product";
import { appUrl, env, isProd } from "@/lib/env";
import { getDb } from "@/lib/db";
import { hmacSha256Hex } from "@/lib/ids";
import { log } from "@/lib/logger";
import { consoleTransport, MailSendError, misconfiguredTransport, resendTransport, smtpTransport } from "./transports";
import type { MailMessage, MailTransport, SendResult } from "./types";

export type { MailMessage, MailTransport, SendResult } from "./types";
export { MailSendError } from "./transports";

/**
 * Picks the transport from env. MAIL_PROVIDER=resend with a missing or blank key used to fall back to the console
 * transport without a word: sign-in answered "check your inbox", nothing was sent and only an info line was logged.
 * In production that is now a transport that fails every send (logged at error by the caller).
 */
export function transportFromEnv(): MailTransport {
  const e = env();
  const key = e.RESEND_API_KEY?.trim(); // a pasted newline would make the Authorization header invalid
  const p = e.MAIL_PROVIDER ?? (key ? "resend" : "console");
  if (p === "resend") {
    if (key) return resendTransport(key);
    if (isProd()) return misconfiguredTransport("resend", "resend_api_key_missing");
    log.warn("mail_provider_fallback", { reason: "resend_api_key_missing", provider: "console" });
    return consoleTransport();
  }
  if (p === "smtp") return smtpTransport();
  return consoleTransport();
}

/** Log fields for a failed send: reason and provider status only. No addresses, tokens, keys or provider text. */
export function mailErrorFields(e: unknown): Record<string, unknown> {
  if (e instanceof MailSendError) return { error: e.message, status: e.status, reason: e.reason };
  const err = e as { name?: string; message?: string };
  const message = String(err?.message ?? e)
    .replace(/mongodb(\+srv)?:\/\/\S+/gi, "mongodb://***")
    .replace(/[^\s@<>"']+@[^\s@<>"']+/g, "[address]")
    .replace(/(token|key|secret)=[^\s&]+/gi, "$1=[redacted]")
    .replace(/\bre_[A-Za-z0-9_]+/g, "[key]")
    .slice(0, 200);
  return { error: err?.name ?? "Error", reason: "exception", detail: message };
}

/** Signing key for unsubscribe and manage links. Production never falls back to a public constant (REVIEW P1-6). */
const unsubSecret = () => {
  const k = env().BETTER_AUTH_SECRET;
  if (k) return k;
  if (isProd()) throw new Error("BETTER_AUTH_SECRET is required to sign email links");
  return "dev-unsubscribe-secret";
};

/** Signed one-click unsubscribe token (RFC 8058). */
export async function unsubscribeToken(email: string, scope: string) {
  return hmacSha256Hex(unsubSecret(), `${email.toLowerCase()}|${scope}`);
}

export async function unsubscribeUrl(email: string, scope: string) {
  const t = await unsubscribeToken(email, scope);
  const q = new URLSearchParams({ e: email.toLowerCase(), s: scope, t });
  return `${appUrl()}/api/mail/unsubscribe?${q}`;
}

/** Signed link token for the no login "manage my alerts" page. One token per email address, so it cannot be reused for another address. */
export async function manageToken(email: string) {
  // A different key from the unsubscribe tokens, so one kind of link can never stand in for the other.
  return hmacSha256Hex(`${unsubSecret()}:manage-link`, email.toLowerCase());
}

export async function manageUrl(email: string) {
  const q = new URLSearchParams({ e: email.toLowerCase(), t: await manageToken(email) });
  return `${appUrl()}/alerts/manage?${q}`;
}

/**
 * The one way to send mail. Checks the suppression list (transactional mail skips marketing scopes),
 * adds List-Unsubscribe + List-Unsubscribe-Post for non-transactional mail.
 */
export async function sendMail(msg: MailMessage, transport: MailTransport = transportFromEnv()): Promise<SendResult> {
  const db = await getDb();
  const category = msg.category ?? "transactional";
  const scope = category === "transactional" ? "transactional" : category;
  if (category !== "transactional" && (await db.isSuppressed(msg.to, scope)))
    return { id: "", provider: transport.name, accepted: false, suppressed: true };
  const headers = { ...msg.headers };
  if (category !== "transactional") {
    const url = await unsubscribeUrl(msg.to, scope);
    headers["List-Unsubscribe"] = `<${url}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const res = await transport.send({ ...msg, headers, from: msg.from ?? env().MAIL_FROM ?? product.mailFrom });
  // Production must never "send" into the in-memory outbox and call it done. The documented stub mode
  // (MAIL_PROVIDER=console + MAIL_CONSOLE_PRINT=1) still works but logs every mail at error; the e2e server
  // (`next start`, E2E_OUTBOX=1, never set on Vercel) reads the outbox on purpose.
  if (res.provider === "console" && isProd() && process.env.E2E_OUTBOX !== "1") {
    log.error("mail_not_delivered", { reason: "console_transport", category });
    if (process.env.MAIL_CONSOLE_PRINT !== "1") throw new MailSendError("mail_not_delivered", undefined, "console_transport");
  }
  return res;
}
