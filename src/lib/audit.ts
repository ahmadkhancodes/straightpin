import { getDb } from "@/lib/db";
import type { AuditEntry } from "@/lib/db/types";

/** Append-only audit log. Actions are stable dotted names: "member.invited", "billing.checkout", "apikey.created". */
export async function audit(e: Omit<AuditEntry, "id" | "app" | "at">) {
  const db = await getDb();
  return db.appendAudit(e);
}
