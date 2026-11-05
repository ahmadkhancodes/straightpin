import { defineConfig } from "@playwright/test";

const PORT = 3100;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}` },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        port: PORT,
        reuseExistingServer: true,
        env: { DB_DRIVER: "memory", E2E_OUTBOX: "1", NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`, MAIL_PROVIDER: "console", BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0000", CRON_SECRET: "e2e-cron" },
      },
});
