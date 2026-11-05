import { createChallenge, randomInt, verifySolution, type Challenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/types";
import { env } from "@/lib/env";

// ALTCHA: self-hosted proof-of-work on public forms (no third party). Replay protection via the rate-limit store.
const secrets = () => {
  const base = env().ALTCHA_HMAC_KEY ?? env().BETTER_AUTH_SECRET ?? "dev-altcha-secret-change-me";
  return { sig: `${base}:sig`, key: `${base}:key` };
};
const COST = 5_000;
const TTL_S = 10 * 60;

export async function newChallenge(): Promise<Challenge> {
  const s = secrets();
  return createChallenge({
    algorithm: "PBKDF2/SHA-256",
    cost: COST,
    counter: randomInt(5_000, 10_000),
    deriveKey,
    expiresAt: Math.floor(Date.now() / 1000) + TTL_S,
    hmacSignatureSecret: s.sig,
    hmacKeySignatureSecret: s.key,
  });
}

/** Accepts the widget's base64 JSON payload ({challenge, solution}) or the object. Single use. */
export async function verifyAltcha(payload: unknown, db?: Db): Promise<boolean> {
  try {
    const p = (typeof payload === "string" ? JSON.parse(atob(payload)) : payload) as { challenge?: Challenge; solution?: unknown };
    if (!p?.challenge || !p.solution) return false;
    const s = secrets();
    const r = await verifySolution({
      challenge: p.challenge,
      solution: p.solution as never,
      deriveKey,
      hmacSignatureSecret: s.sig,
      hmacKeySignatureSecret: s.key,
    });
    if (!r.verified) return false;
    const d = db ?? (await getDb());
    const sig = (p.challenge as unknown as { signature?: string }).signature ?? JSON.stringify(p.challenge).slice(0, 128);
    return (await d.hitRateLimit(`altcha:${sig}`, TTL_S * 1000)) === 1;
  } catch {
    return false;
  }
}
