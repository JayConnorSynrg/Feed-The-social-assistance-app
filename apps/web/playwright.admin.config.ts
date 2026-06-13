import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'
import path from 'path'

// Load .env.local so the spec's Mgmt-API + service-role helpers have their keys.
loadEnv({ path: path.resolve(__dirname, '.env.local') })

const PORT = 3131
const BASE_URL = `http://localhost:${PORT}`

// Dedicated config for the admin Wave-1 e2e. Spins a fresh worktree dev server
// on a free port (reuseExistingServer: false) so we exercise THIS branch's build.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'admin-tab-restyle.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
