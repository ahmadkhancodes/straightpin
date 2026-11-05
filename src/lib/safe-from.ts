/** Only same-site paths: no open redirect through ?from=. Anything else falls back to the matches page. */
export const safeFrom = (v: string | undefined | null): string => (v && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : "/matches");
