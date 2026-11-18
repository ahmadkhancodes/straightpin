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

const EMAIL_RE = /[^\s@<>"',;:()\[\]\\]+@[^\s@<>"',;()\[\]\\]+/g;

/** Domain part only of an address ("Name <a@b.c>" or "a@b.c"); never the local part. */
export function addressDomain(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.match(/@([^\s@<>"',;]+)>?\s*$/);
  return m ? m[1].toLowerCase() : null;
}

/** TEMPORARY diagnostic: strings over 40 chars cut, anything address-like replaced by <email>. */
export function scrubValue(v: unknown): unknown {
  if (typeof v === "string") {
    const t = v.replace(EMAIL_RE, "<email>").replace(/\bre_[A-Za-z0-9_]+/g, "<key>");
    return t.length > 40 ? `${t.slice(0, 40)}...` : t;
  }
  if (Array.isArray(v)) return v.map(scrubValue);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrubValue(x)]));
  return v;
}

/** Transactional provider adapter (Resend REST over fetch, no SDK). */
export function resendTransport(apiKey: string, fetchFn: typeof fetch = fetch): MailTransport {
  return {
    name: "resend",
    async send(msg): Promise<SendResult> {
      const payload = {
        from: msg.from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html,
        reply_to: msg.replyTo, headers: msg.headers && Object.keys(msg.headers).length > 0 ? msg.headers : undefined,
        tags: msg.tags ? Object.entries(msg.tags).map(([name, value]) => ({ name, value })) : undefined,
      };
      const sent = JSON.stringify(payload);
      const res = await fetchFn("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: sent,
      });
      const raw = await res.text().catch(() => "");
      // TODO(remove): temporary delivery diagnostic, see docs/PROGRESS.md.
      try {
        const body = JSON.parse(sent) as Record<string, unknown>;
        let reply: unknown;
        try { reply = scrubValue(JSON.parse(raw)); } catch { reply = scrubValue(raw); }
        log.info("resend_request_shape", {
          status: res.status,
          keys: Object.keys(body),
          toType: typeof body.to,
          toCount: Array.isArray(body.to) ? body.to.length : null,
          fromDomain: addressDomain(body.from),
          toDomains: (Array.isArray(body.to) ? body.to : [body.to]).map(addressDomain),
          headerNames: body.headers && typeof body.headers === "object" ? Object.keys(body.headers) : [],
          tagCount: Array.isArray(body.tags) ? body.tags.length : 0,
          hasReplyTo: body.reply_to !== undefined,
          replyToDomain: addressDomain(body.reply_to),
          htmlLength: typeof body.html === "string" ? body.html.length : 0,
          textLength: typeof body.text === "string" ? body.text.length : 0,
          reply,
        });
      } catch { /* diagnostics must never break a send */ }
      if (!res.ok) {
        // Resend errors look like {statusCode, name: "validation_error", message}. Keep only the name: the message can contain the address.
        const err = (() => { try { return JSON.parse(raw) as { name?: unknown } | null ?? {}; } catch { return {} as { name?: unknown }; } })();
        const reason = typeof err.name === "string" && /^[a-z_]{1,48}$/.test(err.name) ? err.name : undefined;
        throw new MailSendError(`mail_send_failed_${res.status}`, res.status, reason);
      }
      // A 2xx without Resend's string id is not a send (a proxy page, a stub, an error payload with a 2xx).
      // Never fabricate an id: that once made a lost sign-in email look delivered in the logs.
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
 * BufferSol mail gateway (POST {url}/v1/send, Bearer key). The gateway forces this app's own From, so no `from` is sent.
 * record "metadata" keeps OTP / reset bodies out of the gateway log. One Idempotency-Key covers every attempt,
 * so a retry after a timeout that did reach the gateway never double-sends.
 */
const GATEWAY_RETRY = new Set([429, 502, 503]);
export function gatewayTransport(
  url: string,
  key: string,
  opts: { fetchFn?: typeof fetch; timeoutMs?: number; attempts?: number; retryDelayMs?: number } = {},
): MailTransport {
  const { fetchFn = fetch, timeoutMs = 8_000, attempts = 2, retryDelayMs = 300 } = opts;
  return {
    name: "gateway",
    async send(msg): Promise<SendResult> {
      const idempotencyKey = `sp-${uuidv7()}`;
      const body = JSON.stringify({
        to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, replyTo: msg.replyTo,
        record: "metadata", category: "transactional",
      });
      let last: MailSendError = new MailSendError("mail_send_failed", undefined, "gateway_unknown");
      for (let attempt = 1; attempt <= attempts; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await fetchFn(`${url.replace(/\/+$/, "")}/v1/send`, {
            method: "POST",
            headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "idempotency-key": idempotencyKey },
            body,
            signal: ctrl.signal,
          });
          const json = (await res.json().catch(() => ({}))) as { id?: unknown; messageId?: unknown } | null;
          if (res.ok) {
            const id = typeof json?.id === "string" && json.id ? json.id : typeof json?.messageId === "string" ? json.messageId : "";
            if (!id) {
              log.error("gateway_no_id", { status: res.status });
              throw new MailSendError("mail_send_failed_no_id", res.status, "gateway_no_id");
            }
            return { id, provider: "gateway", accepted: true };
          }
          last = new MailSendError(`mail_send_failed_${res.status}`, res.status, `gateway_${res.status}`);
          log.error("mail_gateway_failed", { attempt, status: res.status });
          if (!GATEWAY_RETRY.has(res.status)) throw last;
        } catch (err) {
          if (err instanceof MailSendError && !GATEWAY_RETRY.has(err.status ?? 0)) throw err;
          if (!(err instanceof MailSendError)) {
            last = new MailSendError("mail_send_failed", undefined, "gateway_network");
            log.error("mail_gateway_failed", { attempt, reason: "network" });
          }
        } finally {
          clearTimeout(timer);
        }
        if (attempt < attempts) await new Promise((r) => setTimeout(r, retryDelayMs));
      }
      throw last;
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
