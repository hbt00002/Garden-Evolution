import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT || "8787";
const baseURL = `http://127.0.0.1:${PORT}`;

// Browser tests: the real build, served by the real Worker over a throwaway
// local database (see e2e/serve.mjs). Run them with `npm run e2e`.
//
// On your own machine they use the Chrome you already have installed (no
// download); in CI they use the Chromium that `playwright install` provides.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  // One worker: the tests share one database, and a game takes seconds.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results",
  use: {
    baseURL,
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" }
    }
  ],
  webServer: {
    command: "node e2e/serve.mjs",
    url: `${baseURL}/api/leaderboard`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // The server prints a line for every file it serves (thousands per run);
    // errors still show.
    stdout: "ignore",
    stderr: "pipe"
  }
});
