import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "src/lib/crawl/**/*.test.ts", "src/lib/classify/**/*.test.ts", "ml/**/*.test.ts"],
    env: { NODE_ENV: "test", DB_DRIVER: "memory", APP_NAME: "straightpin", MAIL_PROVIDER: "console" },
  },
});
