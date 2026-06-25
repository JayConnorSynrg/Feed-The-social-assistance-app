/**
 * playwright.lang.config.ts — worktree-local config for preferred-language e2e.
 * Uses port 3001 (dev server started from this worktree) to serve the
 * current-branch code instead of the shared checkout's port-3000 server.
 */
import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, 'apps/web/.env.local') })

export default defineConfig({
  testDir: path.resolve(__dirname, 'apps/web/e2e'),
  testMatch: '**/preferred-language.spec.ts',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: 'http://localhost:3001',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'PORT=3001 npm run dev',
    cwd: path.resolve(__dirname, 'apps/web'),
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      PORT: '3001',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
      NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '',
      FIREWORKS_API_KEY: process.env.FIREWORKS_API_KEY ?? '',
    },
  },
})
