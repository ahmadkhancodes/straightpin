/** Small formatters for the admin pages (server safe: no "use client" imports). */
export const when = (d: Date | number | null | undefined): string => (d ? `${new Date(d).toISOString().slice(0, 16).replace("T", " ")} UTC` : "Never");
export const pct = (r: number | null): string => (r === null ? "No runs" : `${Math.round(r * 100)}%`);
export const usd = (cents: number): string => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
