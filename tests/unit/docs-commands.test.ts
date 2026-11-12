import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allLookupKeys, plans, product } from "@/config/product";

const run = promisify(execFile);
const docs = readdirSync("docs").filter((f) => f.endsWith(".md")).map((f) => [f, readFileSync(`docs/${f}`, "utf8")] as const);
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };

describe("every command in docs/ points at something real", () => {
  it("each `npm run <name>` is a script in package.json", () => {
    const named = docs.flatMap(([f, t]) => [...t.matchAll(/npm run ([a-z:-]+)/g)].map((m) => [f, m[1]!] as const));
    expect(named.length).toBeGreaterThan(0);
    for (const [f, name] of named) expect(pkg.scripts[name], `${f}: npm run ${name}`).toBeTruthy();
  });

  it("each scripts/… or infra/… path and each `cd <dir> &&` exists", () => {
    const paths = docs.flatMap(([f, t]) => [...t.matchAll(/`(?:[^`]*\s)?((?:scripts|infra)\/[\w./-]+)/g)].map((m) => [f, m[1]!.replace(/[.,]$/, "")] as const));
    expect(paths.length).toBeGreaterThan(0);
    for (const [f, p] of paths) expect(existsSync(p), `${f}: ${p}`).toBe(true);
  });

  it("the cron worker the docs deploy with wrangler has its config", () => {
    expect(existsSync("infra/cron-worker/wrangler.toml")).toBe(true);
  });
});

/**
 * LAUNCH_CHECKLIST: "Run `npm run stripe:setup` (lookup keys `straightpin_<plan>_<interval>`, `metadata.app=straightpin`)".
 * The real script runs here against a local stand-in of the Stripe REST endpoints it calls.
 */
describe("npm run stripe:setup against a local Stripe stand-in", () => {
  type Obj = Record<string, string>;
  const products: Obj[] = [];
  const prices: Obj[] = [];
  let server: Server;
  let base = "";

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url!, "http://x");
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const form = Object.fromEntries(new URLSearchParams(body));
        const send = (o: unknown) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
        if (req.headers.authorization !== "Bearer sk_test_standin") { res.statusCode = 401; return send({ error: { message: "bad key" } }); }
        if (req.method === "GET" && url.pathname === "/v1/products/search") return send({ data: products.filter((p) => p["metadata[app]"] === "straightpin") });
        if (req.method === "POST" && url.pathname === "/v1/products") { const p = { id: `prod_${products.length}`, ...form }; products.push(p); return send(p); }
        if (req.method === "GET" && url.pathname === "/v1/prices") {
          const key = url.searchParams.get("lookup_keys[]");
          return send({ data: prices.filter((p) => p.lookup_key === key).map((p) => ({ ...p, metadata: { app: p["metadata[app]"] } })) });
        }
        if (req.method === "POST" && url.pathname === "/v1/prices") { const p = { id: `price_${prices.length}`, ...form }; prices.push(p); return send(p); }
        res.statusCode = 404;
        send({ error: { message: `no route ${req.method} ${url.pathname}` } });
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const setup = () => run("node_modules/.bin/tsx", ["scripts/stripe-setup.ts"], { env: { ...process.env, STRIPE_SECRET_KEY: "sk_test_standin", STRIPE_API_BASE: base }, timeout: 60_000 });

  it("creates one price per plan price with the documented lookup key, amount, interval and metadata.app", async () => {
    await setup();
    expect(prices.map((p) => p.lookup_key).sort()).toEqual(allLookupKeys().sort());
    for (const plan of plans) for (const pr of plan.prices) {
      const made = prices.find((p) => p.lookup_key === pr.lookupKey)!;
      expect(made.lookup_key).toBe(`straightpin_${plan.id}_${pr.interval}`);
      expect(Number(made.unit_amount)).toBe(pr.usd);
      expect(made["recurring[interval]"]).toBe(pr.interval === "once" ? undefined : pr.interval);
      expect(made["metadata[app]"]).toBe(product.slug);
      expect(made.currency).toBe("usd");
    }
    expect(products.every((p) => p["metadata[app]"] === "straightpin")).toBe(true);
  }, 60_000);

  it("is safe to run again: nothing new is created", async () => {
    const before = [products.length, prices.length];
    const { stdout } = await setup();
    expect([products.length, prices.length]).toEqual(before);
    expect(stdout).toMatch(/price exists/);
  }, 60_000);

  it("refuses a lookup key that belongs to another app", async () => {
    const mine = prices.find((p) => p.lookup_key === "straightpin_weekly_week")!;
    mine["metadata[app]"] = "otherapp";
    await expect(setup()).rejects.toMatchObject({ code: 1 });
    mine["metadata[app]"] = "straightpin";
  }, 60_000);
});
