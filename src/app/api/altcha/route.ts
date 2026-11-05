import { json } from "@/lib/http";
import { newChallenge } from "@/lib/security/altcha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ALTCHA challenge for the <altcha-widget challengeurl="/api/altcha"> on public forms. */
export async function GET() {
  return json(await newChallenge());
}
