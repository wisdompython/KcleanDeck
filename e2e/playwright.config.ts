import { defineConfig, devices } from "@playwright/test";

// Runs against the Docker e2e stack (`npm run stack:up`), not the dev stack.
export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8089";

export default defineConfig({
  testDir: "./tests",
  // Tests share one database (prices, settings), so run them one at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"], ["html", { open: "on-failure" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-NG",
    timezoneId: "Africa/Lagos",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      dependencies: ["setup"],
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
