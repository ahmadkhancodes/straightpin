// Ported as pure functions from trayo src/services/consent.ts (D44): opt-in OFF by default for UK/EEA/CH/CA/unknown.
const OPT_IN_REGIONS = new Set([
  "GB", "UK", "CH", "CA", "IS", "LI", "NO",
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

/** Region from Vercel geo header first, then Accept-Language (en-GB -> GB). */
export function regionOf(headers: { get(name: string): string | null }): string | null {
  const geo = headers.get("x-vercel-ip-country");
  if (geo) return geo.toUpperCase();
  const lang = headers.get("accept-language")?.split(",")[0]?.trim();
  const m = lang ? /^[a-z]{2,3}[-_]([A-Za-z]{2})/.exec(lang) : null;
  return m ? m[1]!.toUpperCase() : null;
}

/** Default analytics consent when the visitor has not chosen yet. */
export function defaultConsent(region: string | null): boolean {
  if (!region) return false;
  return !OPT_IN_REGIONS.has(region);
}

export function needsBanner(region: string | null): boolean {
  return !defaultConsent(region);
}
