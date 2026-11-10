import { afterEach, describe, expect, it, vi } from "vitest";
import { resendTransport } from "@/lib/mail/transports";

const API_KEY = "re_SECRETKEY123456";
const TOKEN = "tok_abcdef0123456789abcdef0123456789";
const msg = {
  to: "owner.local@example.com",
  from: "Straightpin <sender.local@mail.example.org>",
  subject: "Your sign-in link",
  text: `https://x.test/verify?token=${TOKEN}`,
  html: `<a href="https://x.test/verify?token=${TOKEN}">go</a>`,
  replyTo: "reply.local@reply.example.net",
  headers: { "X-One": "1" },
  tags: { app: "straightpin" },
};

describe("resend_request_shape", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs the shape and never an address local part, token or API key", async () => {
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
    const reply = { id: "0190aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee", note: `sent to owner.local@example.com ${API_KEY} ${TOKEN} and more text here` };
    const f = (async () => new Response(JSON.stringify(reply), { status: 200 })) as unknown as typeof fetch;
    await resendTransport(API_KEY, f).send(msg);
    const line = out.find((l) => l.includes("resend_request_shape")) ?? "";
    expect(line).not.toBe("");
    const j = JSON.parse(line);
    expect(j).toMatchObject({
      status: 200, toType: "string", toCount: null, fromDomain: "mail.example.org", toDomains: ["example.com"],
      headerNames: ["X-One"], tagCount: 1, hasReplyTo: true, replyToDomain: "reply.example.net", textLength: msg.text.length, htmlLength: msg.html.length,
    });
    expect(j.keys).toEqual(expect.arrayContaining(["from", "to", "subject", "text", "html", "reply_to", "headers", "tags"]));
    for (const bad of ["owner.local", "sender.local", "reply.local", TOKEN, "abcdef0123456789", API_KEY, "SECRETKEY"]) expect(line).not.toContain(bad);
    expect(j.reply.note.length).toBeLessThanOrEqual(43);
  });
});
