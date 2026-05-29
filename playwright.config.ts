import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import dotenv from 'dotenv'

// Load apps/web/.env.local so SERVICE_ROLE_KEY and SUPABASE vars are available
// to the test process. Playwright's webServer inherits these automatically.
dotenv.config({ path: path.resolve(__dirname, 'apps/web/.env.local') })

export default defineConfig({
  testDir: path.resolve(__dirname, 'apps/web/e2e'),
  // Each test gets a full browser context; run sequentially to avoid user collisions.
  workers: 1,
  // Generous timeout for auth flows that hit the real Supabase project over the wire.
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: 'http://localhost:3000',
    // Keep screenshots on failure for debugging selector issues.
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
    command: 'npm run dev',
    cwd: path.resolve(__dirname, 'apps/web'),
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      // Forward the env vars the dev server needs from apps/web/.env.local.
      // The dotenv.config() above populates process.env so we can pass them here.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? '',
    },
  },
})
