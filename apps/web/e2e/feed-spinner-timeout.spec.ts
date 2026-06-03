/**
 * feed-spinner-timeout.spec.ts — Feed read timeout resilience E2E
 *
 * Verifies that when the /rest/v1/posts network request stalls indefinitely,
 * the feed spinner clears within QUERY_TIMEOUT_MS + 5s and a user-facing
 * error message is shown rather than leaving the spinner stuck forever.
 *
 * Pre-fix:  AbortSignal not set → PostgREST never settles → finally never runs →
 *           spinner stuck → test assertion times out → test FAILS.
 *
 * Post-fix: AbortSignal.timeout(QUERY_TIMEOUT_MS) fires → isQueryTimeout detected →
 *           setError("Feed timed out…") → finally { setLoading(false) } → spinner
 *           clears → error message visible → test PASSES.
 *
 * Run:
 *   npx playwright test apps/web/e2e/feed-spinner-timeout.spec.ts --reporter=line
 */

import { test, expect, type Page } from '@playwright/test'
import {
  makeAdminClient,
  provisionVaultUser,
  deleteProvisionedUser,
  type VaultProvisionResult,
} from './helpers/vault-fixture'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Must match apps/web/src/lib/vault.ts QUERY_TIMEOUT_MS
const QUERY_TIMEOUT_MS = 12_000

const USER_PASSWORD = 'Test-FeedTimeout-123!'
const FIXED_TS = '20260603feedtimeout'
const TEST_EMAIL = `e2e+feedtimeout-${FIXED_TS}@feed.local`

// Per-test timeout: QUERY_TIMEOUT_MS + 5s UI buffer + 30s login/setup
const TEST_TIMEOUT_MS = QUERY_TIMEOUT_MS + 5_000 + 30_000

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let provision: VaultProvisionResult

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up any leftover from a prior run with this fixed identifier
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) {
    await deleteProvisionedUser(admin, prior.id)
  }

  provision = await provisionVaultUser({
    adminClient: admin,
    email: TEST_EMAIL,
    password: USER_PASSWORD,
    fullName: 'FeedTimeout Test User',
    phone: '5550003333',
    residentialAddress: {
      line1: '3 Timeout Blvd',
      city: 'Austin',
      state: 'TX',
      zip_code: '73302',
    },
  })
})

test.afterAll(async () => {
  try {
    if (provision?.userId) {
      await deleteProvisionedUser(admin, provision.userId)
      console.log(`[feed-timeout] Deleted test user ${provision.userId}`)
    }
  } catch (err) {
    console.error('[feed-timeout] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAndNavigateToFeed(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', TEST_EMAIL)
  await page.fill('#password', USER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })
  console.log('[feed-timeout] Logged in')

  // Navigate to the Feed panel via sidebar
  const feedSidebarBtn = page.locator('[data-testid="sidebar-feed"]')
  await feedSidebarBtn.click()
  console.log('[feed-timeout] Feed panel activated')
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test('feed spinner clears and error shows when posts read stalls', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS)

  await loginAndNavigateToFeed(page)

  // Install stall BEFORE the next feed load can complete.
  // We intercept the PostgREST /rest/v1/posts request and never fulfill it,
  // simulating a hung network connection.
  await page.route('**/rest/v1/posts**', async (route) => {
    // Never call route.fulfill() or route.continue() — stalls the request.
    console.log('[feed-timeout] Stalling /rest/v1/posts request')
  })

  // Trigger a reload of the feed (e.g. by refreshing) so the stalled request fires.
  // We reload within the same authenticated session.
  await page.reload()

  // The feed spinner should be visible immediately after load starts
  const spinner = page.locator('.animate-spin').first()
  await expect(spinner).toBeVisible({ timeout: 5_000 })
  console.log('[feed-timeout] Feed spinner is visible (stall in progress)')

  // After QUERY_TIMEOUT_MS the AbortSignal fires.
  // Within 5s after that the UI should clear the spinner and show the error.
  await expect(spinner).not.toBeVisible({ timeout: QUERY_TIMEOUT_MS + 5_000 })
  console.log('[feed-timeout] Spinner cleared (finally{setLoading(false)} ran)')

  // The user-facing error message should be visible
  await expect(
    page.getByText(/Feed timed out/i)
  ).toBeVisible({ timeout: 5_000 })
  console.log('[feed-timeout] Timeout error message visible')
})
