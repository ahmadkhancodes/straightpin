/** Egress guard: deny-listed hosts, non-http(s), localhost and private IP literals. */

export const DENY_HOSTS = ['indeed.com', 'linkedin.com', 'glassdoor.com', 'directroles.net'];

export class EgressBlockedError extends Error {
  constructor(public readonly url: string, public readonly reason: string) {
    super(`egress blocked (${reason}): ${url}`);
    this.name = 'EgressBlockedError';
  }
}

function isPrivateIPv4(h: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) ||
    a >= 224;
}

function isPrivateIPv6(h: string): boolean {
  const s = h.replace(/^\[|\]$/g, '').toLowerCase();
  if (!s.includes(':')) return false;
  if (s === '::' || s === '::1') return true;
  if (/^f[cd]/.test(s) || /^fe[89ab]/.test(s)) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (mapped) return isPrivateIPv4(mapped[1] ?? "");
  return /^::ffff:/.test(s); // hex-form mapped addresses: refuse
}

/** True for loopback, private, link-local, CGNAT, multicast and reserved addresses (v4 and v6). */
export function isPrivateAddress(ip: string): boolean {
  return isPrivateIPv4(ip) || isPrivateIPv6(ip);
}

export function assertAllowedHost(url: string): URL {
  let u: URL;
  try { u = new URL(url); } catch { throw new EgressBlockedError(url, 'invalid url'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new EgressBlockedError(url, 'scheme');
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) throw new EgressBlockedError(url, 'empty host');
  if (DENY_HOSTS.some((d) => host === d || host.endsWith('.' + d))) throw new EgressBlockedError(url, 'deny list');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new EgressBlockedError(url, 'local host');
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) throw new EgressBlockedError(url, 'private ip');
  return u;
}
