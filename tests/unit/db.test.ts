import { afterAll } from "vitest";
import { createMemoryDb } from "@/lib/db/memory";
import { dbContract } from "./dbContract";

dbContract("memory", async () => createMemoryDb("postslot"));

// Same contract against a real Mongo (Atlas test DB) when provided.
const uri = process.env.MONGODB_URI_TEST;
if (uri) {
  const dbName = `postslot_test_${Date.now()}`;
  dbContract("mongo", async () => (await import("@/lib/db/mongo")).createMongoDb(uri, dbName, "postslot"));
  afterAll(async () => {
    const c = await (await import("@/lib/db/mongo")).mongoClient(uri);
    await c.db(dbName).dropDatabase();
    await c.close();
  });
}
