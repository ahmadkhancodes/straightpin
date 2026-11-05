import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminEmails } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { getAuth } from "./index";
import { can, type OrgRole } from "./roles";
import type { statements } from "./roles";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  twoFactorEnabled?: boolean | null;
}

export interface OrgContext {
  user: SessionUser;
  sessionId: string;
  org: { id: string; name: string; slug: string };
  role: OrgRole;
}

/** Server components / actions / route handlers: current session or null. */
export async function getSession(h?: Headers) {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: h ?? (await headers()) });
  return s ? { user: s.user as unknown as SessionUser, session: s.session as { id: string; activeOrganizationId?: string | null } } : null;
}

export async function requireUser(opts: { redirectTo?: string } = {}) {
  const s = await getSession();
  if (!s) {
    if (opts.redirectTo !== undefined) redirect(`/sign-in?next=${encodeURIComponent(opts.redirectTo)}`);
    throw new HttpError(401, "unauthorized");
  }
  return s;
}

/** Active org (session.activeOrganizationId, else the first membership). Pages redirect; APIs throw. */
export async function getOrgContext(h?: Headers): Promise<OrgContext | null> {
  const hh = h ?? (await headers());
  const s = await getSession(hh);
  if (!s) return null;
  const auth = await getAuth();
  const orgs = (await auth.api.listOrganizations({ headers: hh })) as { id: string; name: string; slug: string }[];
  if (!orgs.length) return null;
  const org = orgs.find((o) => o.id === s.session.activeOrganizationId) ?? orgs[0]!;
  const member = (await auth.api.getActiveMember({ headers: hh }).catch(() => null)) as { role?: string; organizationId?: string } | null;
  let role = member && member.organizationId === org.id ? member.role : undefined;
  if (!role) {
    const full = (await auth.api.getFullOrganization({ headers: hh, query: { organizationId: org.id } })) as {
      members?: { userId: string; role: string }[];
    } | null;
    role = full?.members?.find((m) => m.userId === s.user.id)?.role;
  }
  return { user: s.user, sessionId: s.session.id, org: { id: org.id, name: org.name, slug: org.slug }, role: ((role?.split(",")[0] ?? "viewer") as OrgRole) };
}

export async function requireOrg(opts: { page?: boolean } = {}): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) {
    if (opts.page) {
      const s = await getSession();
      redirect(s ? "/onboarding" : "/sign-in");
    }
    throw new HttpError(401, "unauthorized");
  }
  return ctx;
}

/** Throws 403 forbidden unless the member's role grants `resource:action`. */
export function requirePermission(ctx: OrgContext, resource: keyof typeof statements, action: string) {
  if (!can(ctx.role, resource, action)) throw new HttpError(403, "forbidden");
}

export const isFounderAdmin = (email: string | null | undefined) => !!email && adminEmails().includes(email.toLowerCase());

/** API key auth for /api/v1/* (x-api-key or Bearer). Returns the owning org id. */
export async function authApiKey(req: Request): Promise<{ orgId: string; keyId: string }> {
  const raw = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!raw) throw new HttpError(401, "missing_api_key");
  const auth = await getAuth();
  const r = (await auth.api.verifyApiKey({ body: { key: raw } })) as { valid: boolean; key?: { id: string; referenceId?: string; userId?: string } | null };
  if (!r.valid || !r.key) throw new HttpError(401, "invalid_api_key");
  return { orgId: r.key.referenceId ?? r.key.userId ?? "", keyId: r.key.id };
}
