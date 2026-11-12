/**
 * Same-site path check for redirect targets (`next`, `back`). Browsers drop tabs and newlines inside URLs, so
 * "/\t/evil.example" becomes "//evil.example" (another site). Anything with control characters,
 * a backslash or a second leading slash is refused, and the result must stay on our own origin.
 */
export function isSafePath(p: string | null | undefined): p is string {
  if (!p || p.length > 2048 || !p.startsWith("/") || p.startsWith("//")) return false;
  if (/[\u0000-\u001f\u007f\\]/.test(p)) return false;
  try {
    const base = "https://same.invalid";
    return new URL(p, base).origin === base;
  } catch {
    return false;
  }
}

/** Only http(s) links leave the site. Stops `javascript:`, `data:` and similar links from crawled job data. */
export function isHttpUrl(u: string | null | undefined): u is string {
  if (!u || u.length > 4096) return false;
  try {
    const { protocol } = new URL(u);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
