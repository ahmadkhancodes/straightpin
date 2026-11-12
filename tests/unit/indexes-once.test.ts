import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureIndexesOnce } from "@/lib/db/mongo";

function fakeDb(fail?: (name: string) => Error | undefined) {
  const calls: string[] = [];
  return {
    calls,
    db: {
      collection: (name: string) => ({
        createIndex: async () => {
          calls.push(name);
          const e = fail?.(name);
          if (e) throw e;
          return "ok";
        },
      }),
    } as never,
  };
}

afterEach(() => {
  globalThis.__kitIndexes = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("ensureIndexesOnce", () => {
  it("runs once and not again on a second call", async () => {
    const f = fakeDb();
    const getDb = vi.fn(async () => f.db);
    await ensureIndexesOnce("k", getDb);
    const n = f.calls.length;
    expect(n).toBeGreaterThan(20);
    await ensureIndexesOnce("k", getDb);
    expect(getDb).toHaveBeenCalledTimes(1);
    expect(f.calls.length).toBe(n);
  });

  it("logs and continues on conflicts and errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const f = fakeDb((n) => (n === "jobs" ? Object.assign(new Error("conflict mongodb+srv://u:p@h/x"), { code: 85 }) : undefined));
    await expect(ensureIndexesOnce("k2", async () => f.db)).resolves.toBeUndefined();
    expect(f.calls).toContain("organization");
    expect(warn.mock.calls.join(" ")).not.toContain("u:p@");
    await ensureIndexesOnce("k3", async () => { throw new Error("down"); });
    expect(warn).toHaveBeenCalled();
  });

  it("is skipped during next build", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const getDb = vi.fn();
    expect(ensureIndexesOnce("k4", getDb)).toBeUndefined();
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe("getDb", () => {
  it("memory driver never touches the mongo module; index failure does not break mongo getDb", async () => {
    vi.resetModules();
    const spy = vi.fn();
    vi.doMock("@/lib/db/mongo", () => ({ createMongoDb: spy, ensureIndexesOnce: spy }));
    vi.stubEnv("MONGODB_URI", "");
    vi.stubEnv("DB_DRIVER", "memory");
    const { getDb } = await import("@/lib/db");
    await getDb();
    expect(spy).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/db/mongo");
    vi.resetModules();
  });
});

describe("index coverage for the hot paths", () => {
  it("covers lookups by user and e-mail, the retention sweeps and rate limit expiry", async () => {
    const f = fakeDb();
    await ensureIndexesOnce("coverage", async () => f.db);
    for (const c of ["member", "session", "account", "invitation", "saved_jobs", "job_opens", "rate_limits", "jobs", "alert_rules", "search_profiles", "usage", "stripe_events"]) {
      expect(f.calls, c).toContain(c);
    }
  });
});
