import { uuidv7 } from "@/lib/ids";
import { log } from "@/lib/logger";
import type { MailMessage, MailTransport, SendResult } from "./types";

/**
 * A send that failed or was skipped. `message` is our own constant (never provider text, which can echo the address);
 * `status` is the provider HTTP status and `reason` a short machine code, both safe to log.
 */
export class MailSendError extends Error {
  constructor(message: string, readonly status?: number, readonly reason?: string) {
    super(message);
    this.name = "MailSendError";
  }
}

/** Dev/test/stub transport: keeps messages in memory and logs the subject (never the body). */
type Boxed = MailMessage & { from: string; id: string; at: Date };
declare global {
  var __kitOutbox: Boxed[] | undefined;
}
/** Shared through globalThis: route bundles can load this module more than once, and the auth instance is cached across them. */
export const outbox: Boxed[] = (globalThis.__kitOutbox ??= []);

export function consoleTransport(): MailTransport {
  return {
    name: "console",
    async send(msg) {
      const id = uuidv7();
      outbox.push({ ...msg, id, at: new Date() });
      if (outbox.length > 200) outbox.shift();
      log.info("mail_console", { subject: msg.subject, id });
      // Stub mode only (no mail provider yet): MAIL_CONSOLE_PRINT=1 prints the body so magic links can be used from logs.
      if ((process.env.NODE_ENV === "development" || process.env.MAIL_CONSOLE_PRINT === "1") && process.env.NODE_ENV !== "test")
        console.log(`\n--- mail ${id} ---\n${msg.text}\n---\n`);
      return { id, provider: "console", accepted: true };
    },
  };
}

/** First 120 characters of a provider body for diagnosis, with addresses, links and token-like strings removed. */
function scrubSnippet(raw: string): string {
  return raw
    .slice(0, 120)
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/[^\s@<>"']+@[^\s@<>"']+/g, "[address]")
    .replace(/\bre_[A-Za-z0-9_]+/g, "[key]")
    .replace(/(token|key|secret)=[^\s&"]+/gi, "$1=[redacted]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[token]");
}

/** Transactional provider adapter (Resend REST over fetch, no SDK). */
export function resendTransport(apiKey: string, fetchFn: typeof fetch = fetch): MailTransport {
  return {
    name: "resend",
    async send(msg): Promise<SendResult> {
      const res = await fetchFn("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: msg.from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html,
          reply_to: msg.replyTo, headers: msg.headers,
          tags: msg.tags ? Object.entries(msg.tags).map(([name, value]) => ({ name, value })) : undefined,
        }),
      });
      if (!res.ok) {
        // Resend errors look like {statusCode, name: "validation_error", message}. Keep only the name: the message can contain the address.
        const err = (await res.json().catch(() => ({}))) as { name?: unknown };
        const reason = typeof err.name === "string" && /^[a-z_]{1,48}$/.test(err.name) ? err.name : undefined;
        throw new MailSendError(`mail_send_failed_${res.status}`, res.status, reason);
      }
      // A 2xx without Resend's string id is not a send (a proxy page, a stub, an error payload with a 2xx).
      // Never fabricate an id: that once made a lost sign-in email look delivered in the logs.
      const raw = await res.text().catch(() => "");
      let id: unknown;
      try { id = (JSON.parse(raw) as { id?: unknown } | null)?.id; } catch { id = undefined; }
      if (typeof id !== "string" || !id) {
        log.error("resend_no_id", { status: res.status, contentType: res.headers.get("content-type") ?? "", body: scrubSnippet(raw) });
        throw new MailSendError("mail_send_failed_no_id", res.status, "resend_no_id");
      }
      return { id, provider: "resend", accepted: true };
    },
  };
}

/**
 * SMTP adapter stub for the VPS (own Postfix/KumoMTA). Implement with nodemailer when the VPS exists;
 * the interface stays the same so no caller changes.
 */
export function smtpTransport(): MailTransport {
  return {
    name: "smtp",
    async send() {
      throw new MailSendError("smtp_transport_not_configured", undefined, "smtp_not_configured");
    },
  };
}

/** Stands in for a provider that is selected but cannot work (missing key). Every send throws, so the failure is logged, never silent. */
export function misconfiguredTransport(name: string, reason: string): MailTransport {
  return {
    name,
    async send() {
      throw new MailSendError("mail_provider_misconfigured", undefined, reason);
    },
  };
}
