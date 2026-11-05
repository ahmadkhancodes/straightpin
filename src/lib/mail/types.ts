// Mailer interface (ported from trayo server/email). Provider adapter now; own SMTP/KumoMTA on the VPS later.
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  /** Suppression scope; "transactional" mail (sign-in links) ignores marketing unsubscribes. */
  category?: "transactional" | "notification" | "marketing";
  tags?: Record<string, string>;
}

export interface SendResult {
  id: string;
  provider: string;
  accepted: boolean;
  suppressed?: boolean;
}

export interface MailTransport {
  readonly name: string;
  send(msg: MailMessage & { from: string }): Promise<SendResult>;
}
