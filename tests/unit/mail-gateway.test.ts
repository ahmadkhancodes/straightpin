import { afterEach, describe, expect, it, vi } from "vitest";
import { MailSendError, gatewayTransport } from "@/lib/mail/transports";
import { transportFromEnv } from "@/lib/mail";

const msg = { to: "owner@example.com", from: "Straightpin <x@y.z>", subject: "Your sign-in link", text: "code 123456", html: "<p>code 123456</p>" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

describe("gatewayTransport", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it("posts to /v1/send with bearer, idempotency key, metadata record and no from", async () => {
    const f = vi.fn(async () => json({ ok: true, id: "gw_1", messageId: "m1" }));
    const r = await gatewayTransport("https://gw.test/", "k", { fetchFn: f as unknown as typeof fetch }).send(msg);
    expect(r).toEqual({ id: "gw_1", provider: "gateway", accepted: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://gw.test/v1/send");
    const h = init.headers as Record<string, string>;
    expect(h.authorization).toBe("Bearer k");
    expect(h["idempotency-key"]).toMatch(/^sp-/);
    const b = JSON.parse(init.body as string);
    expect(b).toMatchObject({ to: msg.to, subject: msg.subject, record: "metadata", category: "transactional" });
    expect(b.from).toBeUndefined();
  });

  it("retries 503 with the same idempotency key, then succeeds", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const f = vi.fn().mockResolvedValueOnce(json({ error: "off" }, 503)).mockResolvedValueOnce(json({ ok: true, id: "gw_2" }));
    const r = await gatewayTransport("https://gw.test", "k", { fetchFn: f as unknown as typeof fetch, retryDelayMs: 1 }).send(msg);
    expect(r.id).toBe("gw_2");
    const keys = f.mock.calls.map((c) => ((c[1] as RequestInit).headers as Record<string, string>)["idempotency-key"]);
    expect(keys[0]).toBe(keys[1]);
  });

  it("does not retry 401/403/422 and throws a MailSendError with the status", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const f = vi.fn(async () => json({ error: "bad" }, 401));
    const err = await gatewayTransport("https://gw.test", "k", { fetchFn: f as unknown as typeof fetch }).send(msg).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MailSendError);
    expect(err).toMatchObject({ status: 401 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("fails after exhausting attempts on network errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const f = vi.fn(async () => { throw new Error("boom owner@example.com"); });
    const err = await gatewayTransport("https://gw.test", "k", { fetchFn: f as unknown as typeof fetch, retryDelayMs: 1 }).send(msg).catch((e: unknown) => e);
    expect(err).toMatchObject({ reason: "gateway_network" });
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("transportFromEnv with the gateway", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("uses the gateway when MAIL_GATEWAY_URL and key are set", () => {
    vi.stubEnv("MAIL_GATEWAY_URL", "https://gw.test");
    vi.stubEnv("MAIL_GATEWAY_KEY", "k");
    vi.stubEnv("RESEND_API_KEY", "re_x");
    expect(transportFromEnv().name).toBe("gateway");
  });
  it("fails loudly (no Resend fallback) when the URL is set without a key", async () => {
    vi.stubEnv("MAIL_GATEWAY_URL", "https://gw.test");
    vi.stubEnv("MAIL_GATEWAY_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "re_x");
    const t = transportFromEnv();
    await expect(t.send({ ...msg })).rejects.toMatchObject({ reason: "mail_gateway_key_missing" });
  });
  it("keeps Resend when MAIL_GATEWAY_URL is unset", () => {
    vi.stubEnv("MAIL_GATEWAY_URL", "");
    vi.stubEnv("RESEND_API_KEY", "re_x");
    vi.stubEnv("MAIL_PROVIDER", "resend");
    expect(transportFromEnv().name).toBe("resend");
  });
});
