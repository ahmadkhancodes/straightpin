import { describe, expect, it } from "vitest";
import { resendTransport } from "@/lib/mail/transports";

const base = { to: "a@example.com", from: "Straightpin <x@resend.dev>", subject: "s", text: "t", html: "<p>t</p>" };

async function sentBody(extra: Record<string, unknown>) {
  let body: Record<string, unknown> = {};
  const f = (async (_u: unknown, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: "0190aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee" }), { status: 200 });
  }) as unknown as typeof fetch;
  await resendTransport("re_x", f).send({ ...base, ...extra } as never);
  return body;
}

describe("resend payload", () => {
  it("omits an empty headers object (transactional mail adds none)", async () => {
    expect(await sentBody({ headers: {} })).not.toHaveProperty("headers");
  });
  it("keeps real headers", async () => {
    expect(await sentBody({ headers: { "List-Unsubscribe": "<https://x.test/u>" } })).toHaveProperty("headers");
  });
});
