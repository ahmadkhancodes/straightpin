/** One-off index creation (never per cold start): MONGODB_URI=... npx tsx scripts/ensure-indexes.ts */
import { ensureIndexes, mongoClient } from "../src/lib/db/mongo";
import { product } from "../src/config/product";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.log("MONGODB_URI not set: skipping (memory driver)");
  process.exit(0);
}
ensureIndexes(uri, process.env.MONGODB_DB ?? product.slug)
  .then(async () => {
    console.log("indexes ensured");
    await (await mongoClient(uri)).close();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
