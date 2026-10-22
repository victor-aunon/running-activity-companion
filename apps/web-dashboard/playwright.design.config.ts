import { defineConfig } from '@playwright/test';

/**
 * Playwright Configuration for Stitch Visual Design Audit
 * Runs webServer against Next.js (npm run dev) and compares against frozen golden screenshots
 */
export default defineConfig({
  testDir: './tests/design',
  snapshotPathTemplate: process.env.FEATURE_DIR
    ? `${process.env.FEATURE_DIR}/designs/{arg}{ext}`
    : '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05, // Calibrated tolerance for OS font rendering differences
      animations: 'disabled',
    },
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'design-audit-desktop',
      use: {
        viewport: { width: 1280, height: 1024 },
        deviceScaleFactor: 2,
        launchOptions: {
          args: [
            '--single-process',
            '--no-zygote',
            '--no-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
          ],
        },
      },
    },
  ],
  webServer: {
    command:
      process.env.PLAYWRIGHT_DEV_COMMAND ||
      'WATCHPACK_POLLING=true pnpm --filter web-dashboard dev',
    url: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
