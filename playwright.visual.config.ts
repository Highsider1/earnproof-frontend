import { defineConfig, devices } from "@playwright/test";

/**
 * Dedicated Playwright configuration for the visual regression suite
 * (e2e/visual). This config is intentionally separate from any other
 * Playwright suites the project may add (functional e2e, a11y, perf) so the
 * visual project can be run, reviewed, and evolved independently.
 *
 * Viewport rationale (see e2e/visual/README.md for the full write-up):
 *  - desktop-1440: the approved desktop breakpoint used across EarnProof's
 *    design references (max page width is 1440px, see pageContainer).
 *  - tablet-768:   intermediate width required by the issue acceptance
 *    criteria; 768px is the Tailwind `md` breakpoint the app already
 *    branches layout on (grid-cols-3 -> stacked, nav collapse, etc.).
 *  - mobile-390:   the approved mobile breakpoint (iPhone 12/13/14 class
 *    device width), the narrowest width the layouts are designed for.
 */
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e/visual",
  outputDir: "./e2e/visual/.test-results",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "./e2e/visual/.report", open: "never" }]]
    : "list",
  timeout: 30_000,
  expect: {
    // Conservative pixel-diff thresholds. Kept small and explicit rather
    // than relying on Playwright defaults so any tightening/loosening is a
    // reviewable, intentional change.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    },
  },
  use: {
    baseURL: BASE_URL,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tablet-768",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
