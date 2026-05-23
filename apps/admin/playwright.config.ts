import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for MarginLab admin E2E tests.
 *
 * Admin tests (tests/e2e/admin/) run against the local Next.js dev server.
 * Storefront tests (tests/e2e/storefront/) run against the marginlab-runtime.js
 * served by a lightweight static fixture server (no Shopify needed).
 *
 * Run: npx playwright test
 * Run one suite: npx playwright test tests/e2e/admin
 */

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }], ["list"]],
  timeout: 30_000,

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "admin-chromium",
      testMatch: "admin/**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3457",
      },
    },
    {
      name: "storefront-chromium",
      testMatch: "storefront/**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:4000",
      },
    },
    {
      name: "storefront-mobile",
      testMatch: "storefront/**/*.spec.ts",
      use: {
        ...devices["Pixel 7"],
        baseURL: "http://localhost:4000",
      },
    },
  ],

  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3457",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npx http-server tests/e2e/storefront/fixtures -p 4000 --cors -s",
      url: "http://localhost:4000",
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
    },
  ],
});
