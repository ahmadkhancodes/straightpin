import { createHash } from "node:crypto";

/** Stable, URL safe job id from (employer, external id). Same input, same id: upserts are idempotent. */
export const jobId = (employerId: string, externalId: string): string =>
  createHash("sha256").update(`${employerId}\u0000${externalId}`).digest("hex").slice(0, 20);
