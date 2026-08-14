import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load environment-specific values (base URL, credentials, API base URL)
// from .env — never hardcode these directly in this file or in specs.
dotenv.config();

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,

  // Everything the healer agent (and CI) needs to diagnose a failure
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/html", open: "never" }],
    ["json", { outputFile: "reports/results.json" }],
    ["junit", { outputFile: "reports/junit.xml" }],
  ],

  use: {
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    {
      // Runs once: logs in and saves the session to playwright/.auth/admin.json.
      // The 'ui' project below depends on this instead of logging in per test.
      name: 'setup',
      testDir: './tests/ui',
      testMatch: /auth\.setup\.ts/,
      use: {
        baseURL: process.env.BASE_URL,
      },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BASE_URL,
        video: 'retain-on-failure',
        storageState: 'playwright/.auth/admin.json',
      },
    },
    {
      name: 'api',
      testDir: './tests/api',
      use: {
        baseURL: process.env.API_BASE_URL,
        // No browser context needed — Playwright's `request` fixture
        // handles API calls directly.
      },
    },
  ],

  // Screenshots / videos / traces land here, per test
  outputDir: "test-artifacts",
});
