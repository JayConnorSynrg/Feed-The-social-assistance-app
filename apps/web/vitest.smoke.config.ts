// vitest.smoke.config.ts — config for prod read-only smoke tests
// Owner: Jelal Connor / SYNRG SCALING, LLC
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['src/**/*.smoke.ts'],
    environment: 'node',
    globals: true,
    // Smoke tests hit the prod API — give each test generous timeout for retry backoff
    // Retry logic: up to 4 retries with 3s/6s/12s/24s backoff = max ~45s per query
    testTimeout: 90000,
    hookTimeout: 10000,
    // Run ALL test files serially in a single worker to avoid 429 rate-limiting
    // from hammering the Supabase Management API simultaneously across 21 files
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // maxConcurrency=1 ensures sequential file execution (default is 5)
    maxConcurrency: 1,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
