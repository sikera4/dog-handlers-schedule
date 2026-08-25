import os from "node:os";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000";
const developmentDataFile = path.join(
  os.tmpdir(),
  `dog-handlers-playwright-${process.pid}.json`,
);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "corepack pnpm@10.34.5 dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      DATA_BACKEND: "development",
      DEV_DATA_FILE: developmentDataFile,
      DEV_ADMIN_PASSWORD: "playwright-local-password",
      ADMIN_SESSION_SECRET: "playwright-local-session-secret-32-characters",
    },
  },
});
