import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { MailSendError, resendTransport } from "@/lib/mail/transports";

const msg = { to: "owner@example.com", from: "Straightpin <onboarding@resend.dev>", subject: "Your sign-in link", text: "https://straightpin.example/api/auth/magic-link/verify?token=abc" };
const fake = (body: string, contentType: string, status = 200) =>
  (async () => new Response(body, { status, headers: { "content-type": contentType } })) as unknown as typeof fetch;

describe("resendTransport: 2xx without an id", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["empty JSON", "{}", "application/json"],
    ["HTML page", "<!doctype html><html><body>Sign in to owner@example.com https://x.test/?token=abc</body></html>", "text/html"],
    ["error payload", '{"statusCode":200,"name":"weird","message":"owner@example.com"}', "application/json"],
    ["non-string id", '{"id":123}', "application/json"],
    ["empty body", "", "text/plain"],
  ])("throws resend_no_id for %s and logs status, content type and a scrubbed snippet", async (_n, body, ct) => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { errors.push(a.join(" ")); });
    const err = await resendTransport("re_key", fake(body, ct)).send(msg).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MailSendError);
    expect(err).toMatchObject({ reason: "resend_no_id", status: 200 });
    const line = errors.find((l) => l.includes("resend_no_id")) ?? "";
    expect(line).toContain("200");
    expect(line).toContain(ct);
    expect(line).not.toContain("owner@example.com");
    expect(line).not.toContain("token=abc");
    expect(line).not.toContain("https://");
  });

  it("returns Resend's own id on success", async () => {
    const r = await resendTransport("re_key", fake('{"id":"re_123"}', "application/json")).send(msg);
    expect(r).toEqual({ id: "re_123", provider: "resend", accepted: true });
  });
});

describe("no module in the send path replaces the global fetch", () => {
  const root = path.resolve(__dirname, "../../src");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) return files(p);
      return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
    });
  const modules = ["lib/mail", "lib/auth", "app/api/auth"].flatMap((d) => files(path.join(root, d)));

  it("finds the modules", () => expect(modules.length).toBeGreaterThan(3));

  it("importing them leaves globalThis.fetch untouched", async () => {
    const original = globalThis.fetch;
    for (const m of modules) await import(/* @vite-ignore */ m);
    expect(globalThis.fetch).toBe(original);
  });
});
