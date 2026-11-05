import { product } from "@/config/product";
import { appUrl, env } from "@/lib/env";
import { getDb } from "@/lib/db";
import { hmacSha256Hex } from "@/lib/ids";
import { consoleTransport, resendTransport, smtpTransport } from "./transports";
import type { MailMessage, MailTransport, SendResult } from "./types";

export type { MailMessage, MailTransport, SendResult } from "./types";

export function transportFromEnv(): MailTransport {
  const e = env();
  const p = e.MAIL_PROVIDER ?? (e.RESEND_API_KEY ? "resend" : "console");
  if (p === "resend" && e.RESEND_API_KEY) return resendTransport(e.RESEND_API_KEY);
  if (p === "smtp") return smtpTransport();
  return consoleTransport();
}

const unsubSecret = () => env().BETTER_AUTH_SECRET ?? "dev-unsubscribe-secret";

/** Signed one-click unsubscribe token (RFC 8058). */
export async function unsubscribeToken(email: string, scope: string) {
  return hmacSha256Hex(unsubSecret(), `${email.toLowerCase()}|${scope}`);
}

export async function unsubscribeUrl(email: string, scope: string) {
  const t = await unsubscribeToken(email, scope);
  const q = new URLSearchParams({ e: email.toLowerCase(), s: scope, t });
  return `${appUrl()}/api/mail/unsubscribe?${q}`;
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
  return transport.send({ ...msg, headers, from: msg.from ?? env().MAIL_FROM ?? product.mailFrom });
}
