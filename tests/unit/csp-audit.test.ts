import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { securityHeaders } from "@/lib/security/headers";

const ROOT = path.join(__dirname, "../..");
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) out.push(p);
  }
  return out;
}
const csp = Object.fromEntries(
  securityHeaders().find((h) => h.key === "Content-Security-Policy")!.value.split("; ").map((d) => { const [k, ...v] = d.split(" "); return [k!, v]; }),
) as Record<string, string[]>;
const files = walk(path.join(ROOT, "src"));
const src = (f: string) => readFileSync(f, "utf8");

describe("CSP matches every origin the app really uses", () => {
  it("is locked down where it matters", () => {
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["script-src"]).not.toContain("*");
    expect(csp["connect-src"]).not.toContain("*");
  });

  it("no client code fetches or opens a socket to an origin connect-src does not list", () => {
    const allowed = csp["connect-src"]!;
    const bad: string[] = [];
    for (const f of files.filter((x) => /["']use client["']/.test(src(x).slice(0, 200)))) {
      for (const m of src(f).matchAll(/(?:fetch|new WebSocket|new EventSource|sendBeacon)\(\s*[`"'](https?:\/\/[^/`"']+|wss?:\/\/[^/`"']+)/g)) {
        if (!allowed.includes(m[1]!)) bad.push(`${path.relative(ROOT, f)} -> ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("no script tag, iframe or external stylesheet is added from an unlisted origin", () => {
    const bad: string[] = [];
    for (const f of files) {
      const t = src(f);
      for (const m of t.matchAll(/<script[^>]*\ssrc=["'](https?:\/\/[^"']+)/g)) if (!csp["script-src"]!.some((o) => m[1]!.startsWith(o))) bad.push(`${f} script ${m[1]}`);
      if (/<iframe\b/.test(t)) bad.push(`${path.relative(ROOT, f)} uses an iframe (no frame-src is allowed)`);
      for (const m of t.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["'](https?:[^"']+)/g)) bad.push(`${f} stylesheet ${m[1]}`);
    }
    expect(bad).toEqual([]);
  });

  it("no route sends a form post to a foreign site by redirect (form-action would swallow it silently)", () => {
    const allowedHosts = ["checkout.stripe.com", "billing.stripe.com"];
    expect(csp["form-action"]).toEqual(["'self'", ...allowedHosts.map((h) => `https://${h}`)]);
    const offenders: string[] = [];
    for (const f of files.filter((x) => x.includes(`${path.sep}api${path.sep}`))) {
      const t = src(f);
      if (/redirect\([^)]*\b(applyUrl|job\.applyUrl)\b/.test(t)) offenders.push(path.relative(ROOT, f));
    }
    expect(offenders).toEqual([]);
  });

  it("every <form action> points at our own routes", () => {
    const bad: string[] = [];
    for (const f of files) for (const m of src(f).matchAll(/<form[^>]*\saction=["'{`]+([^"'}`]+)/g)) if (!m[1]!.startsWith("/") && !m[1]!.startsWith("${esc(url.pathname")) bad.push(`${path.relative(ROOT, f)} ${m[1]}`);
    expect(bad).toEqual([]);
  });

  it("images may come from any https origin (job logos) but never plain http", () => {
    expect(csp["img-src"]).not.toContain("http:");
  });
});

describe("built output carries no secrets", () => {
  const staticDir = path.join(ROOT, ".next", "static");
  const built = existsSync(staticDir);
  (built ? it : it.skip)("client bundles contain no key shapes or server env names", () => {
    const hits: string[] = [];
    const pats: [string, RegExp][] = [
      ["stripe secret key", /sk_(live|test)_[A-Za-z0-9]{10,}/],
      ["stripe webhook secret", /whsec_[A-Za-z0-9]{10,}/],
      ["resend key", /\bre_[A-Za-z0-9]{20,}/],
      ["mongo uri with password", /mongodb(\+srv)?:\/\/[^\s"'/]+:[^\s"'@/]+@/],
      ["secret assigned to a server env name", /\b(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY|CRON_SECRET|MONGODB_URI)["']?\s*[:=]\s*["'][^"']{8,}["']/],
      ["vercel token", /\bvcp_[A-Za-z0-9]{20,}/],
    ];
    const scan = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = path.join(dir, n);
        if (statSync(p).isDirectory()) scan(p);
        else if (/\.(js|css|html|json|map|txt)$/.test(n)) {
          const t = readFileSync(p, "utf8");
          for (const name of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "BETTER_AUTH_SECRET", "CRON_SECRET", "MONGODB_URI"]) {
            const v = process.env[name];
            if (v && v.length >= 12 && t.includes(v)) hits.push(`value of ${name}: ${path.relative(ROOT, p)}`);
          }
          for (const [label, re] of pats) if (re.test(t)) hits.push(`${label}: ${path.relative(ROOT, p)}`);
        }
      }
    };
    scan(staticDir);
    expect(hits).toEqual([]);
  });
});
