// Disposable / throwaway email domains (subset of the community list; extend per product).
const DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "10minutemail.com", "10minutemail.net",
  "tempmail.com", "temp-mail.org", "temp-mail.io", "yopmail.com", "yopmail.net", "trashmail.com", "getnada.com",
  "dispostable.com", "throwawaymail.com", "maildrop.cc", "mintemail.com", "fakeinbox.com", "mailnesia.com",
  "mohmal.com", "emailondeck.com", "tempinbox.com", "spamgourmet.com", "mytemp.email", "tempr.email", "discard.email",
  "burnermail.io", "inboxkitten.com", "moakt.com", "mail.tm", "mailpoof.com", "tmail.ws", "tmpmail.org", "tmpmail.net",
  "fakemail.net", "emailfake.com", "trbvm.com", "byom.de", "spambox.us", "33mail.com", "anonaddy.me",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return true;
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) if (DOMAINS.has(parts.slice(i).join("."))) return true;
  return false;
}

/** Normalised, validated email or null (ported normEmail: lowercase, max 254). */
export function normEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return null;
  return e;
}
