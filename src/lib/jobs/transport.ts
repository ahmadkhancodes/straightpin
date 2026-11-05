import type { Transport } from "@/lib/crawl/net/fetchPolite";

/**
 * The one place the crawl touches the network (plain fetch, no proxy). fetchPolite wraps it with robots, limits and
 * egress rules and follows redirects itself, so this never follows one (a hop could reach a denied or private host).
 */
export const httpTransport = (timeoutMs = 8000): Transport => async (url, headers) => {
  const res = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  const out: Record<string, string> = {};
  res.headers.forEach((v, k) => (out[k] = v));
  const body = res.status === 304 ? "" : (await res.text()).slice(0, 8_000_000);
  return { status: res.status, body, headers: out };
};
