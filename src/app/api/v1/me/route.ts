import { authApiKey } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { json, withApi } from "@/lib/http";
import { enforceRateLimit, RULES } from "@/lib/security/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sample API-key endpoint: `curl -H "x-api-key: <key>" /api/v1/me`. Products add /api/v1/* next to it. */
export const GET = withApi(async (req) => {
  const { orgId, keyId } = await authApiKey(req);
  await enforceRateLimit(`api:${keyId}`, RULES.api, await getDb());
  return json({ orgId });
}, { csrf: false });
