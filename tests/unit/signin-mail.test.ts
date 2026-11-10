import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeMongoClient } from "./fakeMongo";

/**
 * Regression: "sign-in answers status:true but no email arrives". Runs the real Better Auth handler with the production
 * configuration (NODE_ENV=production, MAIL_PROVIDER=resend) and a fake fetch standing in for api.resend.com, on the memory
 * driver and on the Mongo driver (faithful in-memory fake of the driver). Every sign-in must make exactly one Resend POST.
 */
const OWNER = "buffersoltechnologies@gmail.com";
const BASE = "https://straightpin.example.test";
const PROD_ENV: Record<string, string> = {
  NODE_ENV: "production",
  MAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_test_key",
  MAIL_FROM: "Straightpin <onboarding@resend.dev>",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0000",
  NEXT_PUBLIC_APP_URL: BASE,
  DB_DRIVER: "memory",
};

type Call = { url: string; auth: string | null; body: Record<string, any> };

describe.each(["memory", "mongo"] as const)("sign-in sends exactly one email (production config, %s driver)", (driver) => {
  let calls: Call[];
  let reply: () => Response;
  let logs: string[];

  beforeEach(() => {
    for (const [k, v] of Object.entries(PROD_ENV)) vi.stubEnv(k, v);
    globalThis.__kitAuth = undefined;
    globalThis.__kitAuthMemory = undefined;
    globalThis.__kitMemoryDb = undefined;
    if (driver === "mongo") {
      const uri = "mongodb+srv://straightpin-app:pw@fake.test/";
      vi.stubEnv("DB_DRIVER", "mongo");
      vi.stubEnv("MONGODB_URI", uri);
      vi.stubEnv("MONGODB_DB", "straightpin");
      globalThis.__kitMongo = { uri, client: Promise.resolve(fakeMongoClient() as never) };
      globalThis.__kitIndexes = new Map([[`${uri}|straightpin`, Promise.resolve()]]);
    }
    calls = [];
    reply = () => new Response(JSON.stringify({ id: "re_msg_1" }), { status: 200, headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), auth: new Headers(init?.headers).get("authorization"), body: JSON.parse(String(init?.body ?? "{}")) });
      return reply();
    });
    logs = [];
    for (const m of ["log", "warn", "error"] as const)
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { logs.push(`${m} ${a.join(" ")}`); });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    globalThis.__kitAuth = undefined;
    globalThis.__kitAuthMemory = undefined;
    globalThis.__kitMemoryDb = undefined;
    globalThis.__kitMongo = undefined;
  });

  let ip = 0;
  const handler = async () => (await (await import("@/lib/auth")).getAuth()).handler;
  const signIn = async (email: string) =>
    (await handler())(new Request(`${BASE}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": `203.0.113.${++ip % 250}` },
      body: JSON.stringify({ email, callbackURL: "/matches", newUserCallbackURL: "/onboarding" }),
    }));

  const expectOneLink = async (res: Response, email: string, before: number) => {
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: true });
    const sent = calls.slice(before);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://api.resend.com/emails");
    expect(sent[0].auth).toBe("Bearer re_test_key");
    expect(sent[0].body.to).toBe(email);
    expect(sent[0].body.from).toBe(PROD_ENV.MAIL_FROM);
    const link = String(sent[0].body.text).match(/https:\/\/\S+\/api\/auth\/magic-link\/verify\?\S+/)?.[0];
    expect(link?.startsWith(`${BASE}/api/auth/magic-link/verify?token=`)).toBe(true);
    return link!;
  };

  it("first-time address, then the same address as a returning user", async () => {
    const link = await expectOneLink(await signIn(OWNER), OWNER, 0);

    // Click the link: Better Auth creates the user, so the next request is a returning user.
    const verify = await (await handler())(new Request(link, { headers: { "x-forwarded-for": "198.51.100.7" } }));
    if (verify.status !== 302) process.stderr.write(logs.join("\n") + "\n");
    expect(verify.status).toBe(302);
    expect(verify.headers.get("location")).toContain("/onboarding");
    expect(verify.headers.get("set-cookie")).toContain("session_token");

    const before = calls.length;
    await expectOneLink(await signIn(OWNER), OWNER, before);
    expect(logs.filter((l) => l.startsWith("error"))).toEqual([]);
  });

  it("a missing Resend key is logged at error (no address, no link) and the answer stays generic", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const res = await signIn(OWNER);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: true });
    expect(calls).toHaveLength(0);
    const errors = logs.filter((l) => l.startsWith("error"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"msg":"magic_link_send_failed"');
    expect(errors[0]).toContain('"reason":"resend_api_key_missing"');
    expect(logs.join("\n")).not.toContain(OWNER);
    expect(logs.join("\n")).not.toContain("token=");
  });

  it("a Resend rejection is logged at error with the provider status, without the address", async () => {
    reply = () => new Response(JSON.stringify({ statusCode: 403, name: "validation_error", message: `You can only send testing emails to your own email address (${OWNER}).` }), { status: 403 });
    const res = await signIn("someone@example.org");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: true });
    expect(calls).toHaveLength(1);
    const errors = logs.filter((l) => l.startsWith("error"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"status":403');
    expect(errors[0]).toContain('"reason":"validation_error"');
    expect(logs.join("\n")).not.toMatch(/@example\.org|buffersoltechnologies/);
  });
});

describe("mail transport selection in production", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("never silently falls back to the console outbox", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((l: string) => { errors.push(l); });
    const { sendMail } = await import("@/lib/mail");
    const msg = { to: OWNER, subject: "s", text: "t" };

    vi.stubEnv("MAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "   ");
    await expect(sendMail(msg)).rejects.toMatchObject({ reason: "resend_api_key_missing" });

    vi.stubEnv("RESEND_API_KEY", "re_abc\n"); // a pasted newline is trimmed, not sent as a broken header
    let auth = "";
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      auth = new Headers(init.headers).get("authorization") ?? "";
      return new Response("{}");
    });
    await sendMail(msg);
    expect(auth).toBe("Bearer re_abc");
    vi.unstubAllGlobals();

    vi.stubEnv("MAIL_PROVIDER", "console");
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendMail(msg)).rejects.toMatchObject({ reason: "console_transport" });
    expect(errors.some((l) => l.includes('"reason":"console_transport"'))).toBe(true);
    expect(errors.join("\n")).not.toContain(OWNER);
  });
});
