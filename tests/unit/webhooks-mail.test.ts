import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryDb } from "@/lib/db/memory";
import type { Db } from "@/lib/db/types";
import { MAX_ATTEMPTS, backoffMs, emitEvent, isSafeWebhookUrl, retryDueDeliveries, signPayload, verifySignature } from "@/lib/webhooks/outbound";
import { sendMail, unsubscribeToken } from "@/lib/mail";
import { consoleTransport, outbox, resendTransport } from "@/lib/mail/transports";
import { magicLinkEmail } from "@/lib/mail/templates";

let db: Db;
beforeEach(() => { db = createMemoryDb("postslot"); });

describe("outbound webhooks", () => {
  it("signs with HMAC-SHA256 over `t.body` and verifies within tolerance", async () => {
    const t = 1_800_000_000;
    const h = await signPayload("whsec_abc", '{"a":1}', t);
    expect(h).toMatch(/^t=1800000000,v1=[0-9a-f]{64}$/);
    expect(await verifySignature("whsec_abc", '{"a":1}', h, t * 1000)).toBe(true);
    expect(await verifySignature("whsec_abc", '{"a":2}', h, t * 1000)).toBe(false);
    expect(await verifySignature("whsec_abc", '{"a":1}', h, (t + 600) * 1000)).toBe(false);
  });

  it("delivers to subscribed endpoints with signature headers; retries with backoff; gives up after MAX_ATTEMPTS", async () => {
    await db.createWebhookEndpoint({ id: "ep1", orgId: "o1", url: "https://hooks.test/a", secret: "whsec_1", events: ["billing.updated"], enabled: true });
    await db.createWebhookEndpoint({ id: "ep2", orgId: "o1", url: "https://hooks.test/b", secret: "whsec_2", events: ["other"], enabled: true });
    const seen: Request[] = [];
    let fail = true;
    const fetchFn = (async (url: string, init: RequestInit) => {
      seen.push(new Request(url, init));
      return new Response("", { status: fail ? 500 : 200 });
    }) as unknown as typeof fetch;
    const now = new Date(1_800_000_000_000);
    const [d] = await emitEvent("o1", "billing.updated", { plan: "pro" }, { db, fetchFn, now });
    expect(seen).toHaveLength(1); // ep2 not subscribed
    expect(seen[0]!.headers.get("x-webhook-signature")).toMatch(/^t=\d+,v1=/);
    expect(await verifySignature("whsec_1", await seen[0]!.text(), seen[0]!.headers.get("x-webhook-signature")!, now.getTime())).toBe(true);
    expect(d).toMatchObject({ status: "retrying", attempts: 1, lastStatusCode: 500 });
    expect(d!.nextAttemptAt!.getTime() - now.getTime()).toBeGreaterThanOrEqual(27_000);

    fail = false;
    const later = new Date(now.getTime() + 60_000);
    expect(await retryDueDeliveries({ db, fetchFn, now: later })).toEqual({ processed: 1, succeeded: 1 });
    expect((await db.getDelivery("o1", d!.id))?.status).toBe("succeeded");

    fail = true;
    let [x] = await emitEvent("o1", "billing.updated", {}, { db, fetchFn, now });
    let t = now.getTime();
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      t += 13 * 3600_000;
      await retryDueDeliveries({ db, fetchFn, now: new Date(t) });
    }
    x = (await db.getDelivery("o1", x!.id))!;
    expect(x).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, nextAttemptAt: null });
  });

  it("backoff grows and SSRF targets are refused", () => {
    expect(backoffMs(1, () => 0.5)).toBe(30_000);
    expect(backoffMs(8, () => 0.5)).toBe(43_200_000);
    expect(isSafeWebhookUrl("https://hooks.example.com/x")).toBe(true);
    for (const u of ["http://localhost/x", "https://127.0.0.1/x", "https://10.0.0.2/", "https://192.168.1.1", "https://169.254.169.254/", "ftp://x.test", "nope"])
      expect(isSafeWebhookUrl(u)).toBe(false);
  });
});

describe("mailer", () => {
  it("console transport records mail; transactional mail ignores marketing suppression", async () => {
    const before = outbox.length;
    const m = magicLinkEmail("https://app.test/api/auth/magic-link/verify?token=t");
    expect(m.html).toContain("Sign in");
    const r = await sendMail({ to: "dana@studio.test", ...m }, consoleTransport());
    expect(r.accepted).toBe(true);
    expect(outbox.length).toBe(before + 1);
    expect(outbox.at(-1)!.headers?.["List-Unsubscribe"]).toBeUndefined();
  });

  it("non-transactional mail carries RFC 8058 headers and respects the suppression list", async () => {
    const r = await sendMail({ to: "lee@agency.test", subject: "Digest", text: "x", category: "notification" }, consoleTransport());
    expect(r.accepted).toBe(true);
    const sent = outbox.at(-1)!;
    expect(sent.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(sent.headers?.["List-Unsubscribe"]).toContain("/api/mail/unsubscribe?");
    const { getDb } = await import("@/lib/db");
    await (await getDb()).addSuppression({ email: "lee@agency.test", scope: "notification", reason: "unsubscribe" });
    expect((await sendMail({ to: "lee@agency.test", subject: "Digest", text: "x", category: "notification" }, consoleTransport())).suppressed).toBe(true);
  });

  it("unsubscribe tokens are deterministic per email+scope", async () => {
    expect(await unsubscribeToken("A@x.test", "notification")).toBe(await unsubscribeToken("a@x.test", "notification"));
    expect(await unsubscribeToken("a@x.test", "notification")).not.toBe(await unsubscribeToken("a@x.test", "marketing"));
  });

  it("resend adapter posts to the provider and surfaces failures", async () => {
    let body: any;
    const ok = resendTransport("re_test", (async (_u: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ id: "re_1" }));
    }) as unknown as typeof fetch);
    expect((await ok.send({ to: "a@x.test", subject: "s", text: "t", from: "A <a@x.test>" })).id).toBe("re_1");
    expect(body.from).toBe("A <a@x.test>");
    const bad = resendTransport("re_test", (async () => new Response("", { status: 422 })) as unknown as typeof fetch);
    await expect(bad.send({ to: "a@x.test", subject: "s", text: "t", from: "x" })).rejects.toThrow("mail_send_failed_422");
  });
});
