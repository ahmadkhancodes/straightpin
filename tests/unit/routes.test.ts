import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDb } from "@/lib/db/memory";
import type { Db } from "@/lib/db/types";
import { unsubscribeUrl } from "@/lib/mail";

let current: () => Promise<Db>;
vi.mock("@/lib/db", () => ({ getDb: () => current() }));

import { GET as health } from "@/app/api/health/route";
import { GET as unsubGet, POST as unsubPost } from "@/app/api/mail/unsubscribe/route";

let db: Db;
beforeEach(() => {
  db = createMemoryDb("straightpin");
  current = async () => db;
});

describe("P1-5 health route", () => {
  it("200 when the database answers", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
  it("503 when the database throws", async () => {
    current = async () => { throw new Error("connect ECONNREFUSED"); };
    const res = await health();
    expect(res.status).toBe(503);
    expect((await res.json()).ok).toBe(false);
  });
  it("503 when the database hangs past 2 seconds", async () => {
    vi.useFakeTimers();
    current = () => new Promise<Db>(() => undefined);
    const p = health();
    await vi.advanceTimersByTimeAsync(2100);
    const res = await p;
    vi.useRealTimers();
    expect(res.status).toBe(503);
  });
});

describe("P1-6 unsubscribe needs a click", () => {
  const link = async () => unsubscribeUrl("lee@x.test", "notification");

  it("GET (a mail scanner prefetch) shows a confirm button and does not unsubscribe", async () => {
    const url = await link();
    const res = await unsubGet(new Request(url));
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<form method="post"');
    expect(html).toContain("Yes, unsubscribe");
    expect(html).not.toContain("You are unsubscribed");
    expect(await db.isSuppressed("lee@x.test", "notification")).toBe(false);
  });

  it("POST from the confirm button unsubscribes and shows the result page", async () => {
    const url = await link();
    const res = await unsubPost(new Request(url, { method: "POST", body: new URLSearchParams({ confirm: "1" }), headers: { "content-type": "application/x-www-form-urlencoded" } }));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("You are unsubscribed");
    expect(await db.isSuppressed("lee@x.test", "notification")).toBe(true);
  });

  it("RFC 8058 one-click POST unsubscribes and answers in plain text", async () => {
    const url = await link();
    const res = await unsubPost(new Request(url, { method: "POST", body: new URLSearchParams({ "List-Unsubscribe": "One-Click" }), headers: { "content-type": "application/x-www-form-urlencoded" } }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Unsubscribed");
    expect(await db.isSuppressed("lee@x.test", "notification")).toBe(true);
  });

  it("a forged token does nothing on GET or POST", async () => {
    const bad = (await link()).replace(/t=[^&]+/, "t=forged");
    expect((await unsubGet(new Request(bad))).status).toBe(400);
    expect((await unsubPost(new Request(bad, { method: "POST" }))).status).toBe(400);
    expect(await db.isSuppressed("lee@x.test", "notification")).toBe(false);
  });
});

describe("social images and favicon", () => {
  it("pageMetadata and the root layout carry og:image and twitter:image", async () => {
    const { pageMetadata, ogImageUrl } = await import("@/lib/seo");
    const m = pageMetadata({ title: "T", description: "D", path: "/x" });
    expect(JSON.stringify(m.openGraph?.images)).toContain("/opengraph-image");
    expect(JSON.stringify(m.twitter?.images)).toContain(ogImageUrl());
    expect(ogImageUrl()).toMatch(/^https?:\/\//);
  });
  it("redirects /favicon.ico to /icon", async () => {
    const cfg = (await import("../../next.config")).default;
    const r = await cfg.redirects!();
    expect(r).toContainEqual(expect.objectContaining({ source: "/favicon.ico", destination: "/icon" }));
  });
});
