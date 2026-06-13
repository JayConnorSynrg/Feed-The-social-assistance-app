import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import dotenv from 'dotenv'

// Wave 6b CSP harness config: targets an ALREADY-RUNNING production server
// (npm run start on :4123) so the policy under test is the production CSP.
// No webServer block → Playwright does not start/reuse a dev server, avoiding
// mis-attribution against the dev-mode ('unsafe-eval') policy.
dotenv.config({ path: path.resolve(__dirname, 'apps/web/.env.local') })

export default defineConfig({
  testDir: path.resolve(__dirname, 'apps/web/e2e'),
  testMatch: 'csp-nonce.spec.ts',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.CSP_BASE_URL ?? 'http://localhost:4123',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
