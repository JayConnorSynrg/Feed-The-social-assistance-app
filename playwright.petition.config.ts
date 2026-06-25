import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import dotenv from 'dotenv'

// Isolated config for the petition-signatures feature e2e: dedicated free port
// + reuseExistingServer:false so this worktree's dev server is the one under test
// (never an unrelated server already on :3000 from a sibling worktree).
dotenv.config({ path: path.resolve(__dirname, 'apps/web/.env.local') })

const PORT = 3117
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: path.resolve(__dirname, 'apps/web/e2e'),
  testMatch: 'petition-signatures-admin.spec.ts',
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    cwd: path.resolve(__dirname, 'apps/web'),
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      NEXT_PUBLIC_APP_URL: BASE_URL,
      NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '',
      FIREWORKS_API_KEY: process.env.FIREWORKS_API_KEY ?? '',
    },
  },
})
