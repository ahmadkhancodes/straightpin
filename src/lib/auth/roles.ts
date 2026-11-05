import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc, ownerAc } from "better-auth/plugins/organization/access";

// Org roles: owner / admin / member / viewer. App statements extend Better Auth's defaults.
export const statements = {
  ...defaultStatements,
  billing: ["read", "manage"],
  apiKey: ["read", "manage"],
  webhook: ["read", "manage"],
  audit: ["read"],
  data: ["read", "write"],
} as const;

export const ac = createAccessControl(statements);

export const owner = ac.newRole({
  ...ownerAc.statements,
  billing: ["read", "manage"],
  apiKey: ["read", "manage"],
  webhook: ["read", "manage"],
  audit: ["read"],
  data: ["read", "write"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  billing: ["read"],
  apiKey: ["read", "manage"],
  webhook: ["read", "manage"],
  audit: ["read"],
  data: ["read", "write"],
});

export const member = ac.newRole({
  billing: ["read"],
  apiKey: ["read"],
  webhook: ["read"],
  data: ["read", "write"],
});

export const viewer = ac.newRole({
  data: ["read"],
});

export const roles = { owner, admin, member, viewer };
export type OrgRole = keyof typeof roles;
export const ROLE_ORDER: OrgRole[] = ["viewer", "member", "admin", "owner"];

/** Pure permission table used by server guards and UI (mirrors the roles above). */
export function can(role: string | null | undefined, resource: keyof typeof statements, action: string): boolean {
  const r = roles[(role ?? "") as OrgRole];
  if (!r) return false;
  const allowed = (r.statements as Record<string, readonly string[] | undefined>)[resource];
  return !!allowed?.includes(action);
}
