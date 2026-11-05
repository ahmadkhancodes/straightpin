/** Founder admin totals. Mongo when MONGODB_URI is set, else the in-memory auth store (stub mode). */
export async function adminOverview(): Promise<{ users: number; orgs: number; paidOrgs: number }> {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    const { mongoClient } = await import("@/lib/db/mongo");
    const client = await mongoClient(uri);
    const db = client.db(process.env.MONGODB_DB ?? "straightpin");
    const [users, orgs, paidOrgs] = await Promise.all([
      db.collection("user").countDocuments(),
      db.collection("organization").countDocuments(),
      db.collection("entitlements").countDocuments({ isPaid: true, app: process.env.APP_NAME ?? "straightpin" }),
    ]);
    return { users, orgs, paidOrgs };
  }
  const mem = globalThis.__kitAuthMemory;
  return { users: mem?.user?.length ?? 0, orgs: mem?.organization?.length ?? 0, paidOrgs: 0 };
}

export interface AdminUser {
  userId: string;
  email: string;
  name: string;
  orgId: string | null;
}

/** Find a user by email and the organization that holds their billing. Mongo when set, else the in-memory auth store. */
export async function lookupUserByEmail(email: string): Promise<AdminUser | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const uri = process.env.MONGODB_URI;
  if (uri) {
    const { mongoClient } = await import("@/lib/db/mongo");
    const { ObjectId } = await import("mongodb");
    const d = (await mongoClient(uri)).db(process.env.MONGODB_DB ?? "straightpin");
    const u = await d.collection("user").findOne({ email: e });
    if (!u) return null;
    const ids: unknown[] = [String(u._id), u.id as unknown].filter(Boolean);
    if (ObjectId.isValid(String(u._id))) ids.push(new ObjectId(String(u._id)));
    const m = await d.collection("member").findOne({ userId: { $in: ids as never[] } });
    return { userId: String(u._id), email: String(u.email), name: String(u.name ?? ""), orgId: m ? String(m.organizationId) : null };
  }
  const mem = globalThis.__kitAuthMemory as Record<string, { id?: string; email?: string; name?: string; userId?: string; organizationId?: string }[]> | undefined;
  const u = mem?.user?.find((x) => x.email?.toLowerCase() === e);
  if (!u?.id) return null;
  const m = mem?.member?.find((x) => x.userId === u.id);
  return { userId: u.id, email: u.email ?? e, name: u.name ?? "", orgId: m?.organizationId ?? null };
}
