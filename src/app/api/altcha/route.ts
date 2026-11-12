import { failure, limitRequest } from "@/lib/security/guard";
import { RULES } from "@/lib/security/ratelimit";
import { json } from "@/lib/http";
import { newChallenge } from "@/lib/security/altcha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ALTCHA challenge for the <altcha-widget challengeurl="/api/altcha"> on public forms. */
export async function GET(req: Request) {
  try {
    await limitRequest(req, "altcha", RULES.publicRead);
  } catch (e) {
    return failure(e, { wantsJson: true, route: "/api/altcha" });
  }
  return json(await newChallenge());
}
