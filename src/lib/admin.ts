/** Founder admin totals. Mongo when MONGODB_URI is set, else the in-memory auth store (stub mode). */
export async function adminOverview(): Promise<{ users: number; orgs: number; paidOrgs: number }> {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    const { mongoClient } = await import("@/lib/db/mongo");
    const client = await mongoClient(uri);
    const db = client.db(process.env.MONGODB_DB ?? "postslot");
    const [users, orgs, paidOrgs] = await Promise.all([
      db.collection("user").countDocuments(),
      db.collection("organization").countDocuments(),
      db.collection("entitlements").countDocuments({ isPaid: true, app: process.env.APP_NAME ?? "postslot" }),
    ]);
    return { users, orgs, paidOrgs };
  }
  const mem = globalThis.__kitAuthMemory;
  return { users: mem?.user?.length ?? 0, orgs: mem?.organization?.length ?? 0, paidOrgs: 0 };
}
