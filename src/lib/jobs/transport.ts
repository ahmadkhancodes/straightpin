import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { EgressBlockedError, isPrivateAddress } from "@/lib/crawl/net/egress";
import type { Transport } from "@/lib/crawl/net/fetchPolite";

/** Largest body we keep from one fetch. Bigger answers are cut off while streaming, never buffered whole. */
export const MAX_BODY_BYTES = 8_000_000;

type Lookup = (host: string) => Promise<{ address: string }[]>;
const systemLookup: Lookup = (host) => lookup(host, { all: true, verbatim: true });

/**
 * A crawled host name (sitemap entry, redirect target) can point at an internal address even when the URL is not an
 * IP literal. Resolve it and refuse private, loopback and link-local answers before connecting.
 */
export async function assertPublicHost(url: string, resolve: Lookup = systemLookup): Promise<void> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await resolve(host).catch(() => []);
  if (!addrs.length) throw new EgressBlockedError(url, "dns");
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new EgressBlockedError(url, "private ip (dns)");
}

/** Reads at most `max` bytes of the body, then cancels the stream. */
export async function readCapped(res: Response, max = MAX_BODY_BYTES): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = max - size;
    chunks.push(value.byteLength > room ? value.subarray(0, room) : value);
    size += Math.min(value.byteLength, room);
    if (size >= max) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * The one place the crawl touches the network (plain fetch, no proxy). fetchPolite wraps it with robots, limits and
 * egress rules and follows redirects itself, so this never follows one (a hop could reach a denied or private host).
 */
export const httpTransport = (timeoutMs = 8000, resolve: Lookup = systemLookup): Transport => async (url, headers) => {
  await assertPublicHost(url, resolve);
  const res = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  const out: Record<string, string> = {};
  res.headers.forEach((v, k) => (out[k] = v));
  const body = res.status === 304 ? "" : await readCapped(res);
  return { status: res.status, body, headers: out };
};
