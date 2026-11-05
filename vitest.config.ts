import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    env: { NODE_ENV: "test", DB_DRIVER: "memory", APP_NAME: "postslot", MAIL_PROVIDER: "console" },
  },
});
