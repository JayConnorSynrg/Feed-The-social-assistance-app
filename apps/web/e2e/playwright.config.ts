import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'

/**
 * FEED Smoke Test Suite
 * Runs against real prod: https://www.sourcetofeed.com
 * Set BASE_URL env var to override.
 *
 * One shared test user is created in global setup and torn down after all tests.
 * delete-account.spec uses its own ephemeral user (self-destructs).
 */

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'line',
  globalSetup: path.join(__dirname, 'global-setup.ts'),
  globalTeardown: path.join(__dirname, 'global-teardown.ts'),

  use: {
    baseURL: process.env.BASE_URL ?? 'https://www.sourcetofeed.com',
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: false,
    video: 'off',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
