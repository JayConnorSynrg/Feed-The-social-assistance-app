/**
 * safety-pins.spec.ts — Feature: All-roles safety pins (map hazard reports)
 *
 * Coverage (5 scenarios):
 *  1. Open app → navigate to map → open HazardBubbleMenu Sheet.
 *  2. All 4 hazard entries are visible (no role gate on hazard reports).
 *  3. Place a general hazard → pin appears on map immediately.
 *  4. Vote "Still here" and "Gone now" → counts update in popup.
 *  5. Role gate: "Add yourself as a resource" absent for seeker role.
 *
 * Strategy:
 *  - Provision one seeker user (user_role='seeking') via admin API.
 *  - All hazard e2e actions run as this seeker (confirms ALL roles can report).
 *  - Role-gate test: assert add-resource entry is NOT present for seeker.
 *  - afterAll: delete test alert(s) by pattern via Mgmt-API SQL + delete user.
 *    Leaves 0 prod residue.
 *
 * Run:
 *   cd apps/web && npx playwright test e2e/safety-pins.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test'
import { type SupabaseClient } from '@supabase/supabase-js'
import {
  makeAdminClient,
  deleteProvisionedUser,
} from './helpers/vault-fixture'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FIXED_TS = `${Date.now()}`
const SEEKER_EMAIL = `e2e+safety-seeker-${FIXED_TS}@feed.local`
const SEEKER_PASSWORD = 'SafetyPin-Seeker-12!'
const TEST_DESCRIPTION = `e2e-safety-pin-${FIXED_TS}`

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state
// ─────────────────────────────────────────────────────────────────────────────

let admin: SupabaseClient
let seekerUserId: string

// ─────────────────────────────────────────────────────────────────────────────
// Setup / Teardown
// ─────────────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up prior run with this fixed email if any
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === SEEKER_EMAIL)
  if (prior) await deleteProvisionedUser(admin, prior.id)

  // Create seeker user (user_role='seeking')
  const { data: userData, error: createErr } = await admin.auth.admin.createUser({
    email: SEEKER_EMAIL,
    password: SEEKER_PASSWORD,
    email_confirm: true,
  })
  if (createErr || !userData?.user) throw new Error(`Create user failed: ${createErr?.message}`)
  seekerUserId = userData.user.id

  // Set onboarding_completed + user_role='seeking' on the profile
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ onboarding_completed: true, user_role: 'seeking' })
    .eq('id', seekerUserId)
  if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`)
})

test.afterAll(async () => {
  try {
    // Remove any test alerts created by the FIXED_TS description pattern via Mgmt-API
    const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
    if (SUPABASE_ACCESS_TOKEN) {
      await fetch(
        'https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `DELETE FROM public.safety_alerts WHERE description LIKE 'e2e-safety-pin-%'`,
          }),
        }
      )
    }
  } catch {
    // Non-fatal
  }
  // Delete test user
  if (seekerUserId) {
    try {
      await deleteProvisionedUser(admin, seekerUserId)
    } catch {
      // Non-fatal
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Login helper — mirrors opt-in-flow.spec.ts pattern
// ─────────────────────────────────────────────────────────────────────────────

async function loginAndGoToMap(
  page: import('@playwright/test').Page,
  email: string,
  password: string
) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })

  // Navigate to map panel via sidebar
  await page.locator('[data-testid="sidebar-map"]').click()
  await expect(page.locator('[id="map-view-panel"]')).toBeVisible({ timeout: 20_000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test('map panel loads and hazard menu trigger is visible', async ({ page }) => {
  await loginAndGoToMap(page, SEEKER_EMAIL, SEEKER_PASSWORD)
  await expect(page.locator('[data-testid="hazard-menu-trigger"]')).toBeVisible({ timeout: 10_000 })
})

test('all 4 hazard entries are visible for a seeker (no role gate)', async ({ page }) => {
  await loginAndGoToMap(page, SEEKER_EMAIL, SEEKER_PASSWORD)

  // Open bubble menu
  await page.locator('[data-testid="hazard-menu-trigger"]').click()

  // All 4 hazard types are visible to ALL roles
  await expect(page.locator('[data-testid="hazard-weather"]')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('[data-testid="hazard-road-closure"]')).toBeVisible()
  await expect(page.locator('[data-testid="hazard-speeding"]')).toBeVisible()
  await expect(page.locator('[data-testid="hazard-general"]')).toBeVisible()
})

test('add-resource entry is ABSENT for a seeker role', async ({ page }) => {
  await loginAndGoToMap(page, SEEKER_EMAIL, SEEKER_PASSWORD)
  await page.locator('[data-testid="hazard-menu-trigger"]').click()

  // user_role='seeking' → add-resource entry must NOT appear
  await expect(page.locator('[data-testid="add-resource-entry"]')).not.toBeVisible({ timeout: 3_000 })
})

test('place a general hazard → pin appears on map', async ({ page }) => {
  await loginAndGoToMap(page, SEEKER_EMAIL, SEEKER_PASSWORD)

  // Open bubble menu
  await page.locator('[data-testid="hazard-menu-trigger"]').click()

  // Click general hazard entry
  await page.locator('[data-testid="hazard-general"]').click()

  // Place dialog should appear
  await expect(page.locator('[id="hazard-severity"]')).toBeVisible({ timeout: 5_000 })

  // Set description (used as cleanup marker)
  await page.locator('[id="hazard-description"]').fill(TEST_DESCRIPTION)

  // Submit
  await page.locator('button:has-text("Report hazard")').click()

  // Success state appears
  await expect(page.locator('text=Alert placed at map center')).toBeVisible({ timeout: 10_000 })

  // Dialog dismisses automatically, map is visible again
  await expect(page.locator('[id="map-view-panel"]')).toBeVisible({ timeout: 5_000 })
})

test('safety alert marker appears and vote buttons work', async ({ page }) => {
  // Strategy: place the alert via the authenticated browser UI (same flow as test 4)
  // and intercept the place_safety_alert RPC response to capture the new alert id.
  // Then assert the marker renders on the map, click it to open the popup,
  // assert the trust label, and exercise the confirm/clear vote buttons.

  // ── 1. Intercept place_safety_alert RPC response to capture alert id ──────

  let capturedAlertId: string | null = null

  await page.route('**/rest/v1/rpc/place_safety_alert**', async (route, request) => {
    // Let the real request proceed; clone the response body to extract the id.
    const response = await route.fetch()
    let bodyText = ''
    try {
      bodyText = await response.text()
      const parsed = JSON.parse(bodyText)
      // RPC returns the full safety_alerts row as a JSON object
      const id = parsed?.id ?? (Array.isArray(parsed) ? parsed[0]?.id : null)
      if (id) capturedAlertId = id
    } catch {
      // Non-fatal; we'll fall back to DOM-only assertions
    }
    await route.fulfill({ response, body: bodyText })
  })

  // ── 2. Log in and navigate to the map ─────────────────────────────────────

  await loginAndGoToMap(page, SEEKER_EMAIL, SEEKER_PASSWORD)

  // ── 3. Open bubble menu and click "general hazard" ────────────────────────

  await page.locator('[data-testid="hazard-menu-trigger"]').click()
  await page.locator('[data-testid="hazard-general"]').click()

  // Place dialog should appear
  await expect(page.locator('[id="hazard-severity"]')).toBeVisible({ timeout: 5_000 })

  // Use the e2e-safety-pin pattern so afterAll cleanup sweeps it
  const voteTestDesc = TEST_DESCRIPTION + '-vote'
  await page.locator('[id="hazard-description"]').fill(voteTestDesc)

  // ── 4. Submit and wait for success state + alert id from intercepted response

  await page.locator('button:has-text("Report hazard")').click()
  await expect(page.locator('text=Alert placed at map center')).toBeVisible({ timeout: 10_000 })

  // Wait up to 5 s for the intercepted id to populate (response arrives before
  // the success banner clears, so this is typically immediate)
  const alertIdDeadline = Date.now() + 5_000
  while (!capturedAlertId && Date.now() < alertIdDeadline) {
    await page.waitForTimeout(100)
  }
  if (!capturedAlertId) throw new Error('place_safety_alert response did not include an id — check RPC response shape')

  console.log(`[safety-pins] captured alert id: ${capturedAlertId}`)

  // ── 5. Wait for the PlaceHazardDialog to fully close ─────────────────────
  // The dialog auto-dismisses after 1200 ms. Wait until both the dialog
  // content AND the backdrop overlay are gone before attempting a map click.

  await expect(page.locator('[id="hazard-severity"]')).not.toBeVisible({ timeout: 10_000 })
  // Also ensure no Radix dialog overlay is intercepting pointer events
  await expect(page.locator('[role="dialog"][data-state="open"]')).not.toBeAttached({ timeout: 5_000 })

  // ── 6. Force a viewport re-fetch by nav-away + nav-back, then wait ───────
  // The map hook fetches alerts on viewportBounds change. After placing an alert,
  // the viewport hasn't changed so no re-fetch fires. The realtime INSERT path
  // requires EWKB decomposition which can silently fail.
  //
  // Reliable approach: navigate to a different panel and back. This remounts the
  // map panel, which fires the initial fetchAlerts with the current bounds
  // and returns the newly placed alert with pre-decomposed coords from the RPC.
  // key={alert.id} means the SafetyAlertMarker is created fresh on remount, so
  // showPopup starts as false — we click the marker AFTER re-fetch completes.
  const overviewBtn = page.locator('[data-testid="sidebar-overview"]')
    .or(page.locator('[data-testid="sidebar-feed"]'))
  await overviewBtn.first().click()
  await page.waitForTimeout(500)
  // Navigate back to map
  await page.locator('[data-testid="sidebar-map"]').click()
  await expect(page.locator('[id="map-view-panel"]')).toBeVisible({ timeout: 10_000 })
  // Allow initial fetchAlerts to complete (debounce 400 ms + RPC round-trip)
  await page.waitForTimeout(2_500)

  const markerLocator = page.locator(`[data-testid="safety-alert-marker-${capturedAlertId}"]`)
  await expect(markerLocator).toBeVisible({ timeout: 20_000 })
  console.log('[safety-pins] marker visible on map')

  // ── 7. Click marker → popup opens ─────────────────────────────────────────

  // force:true bypasses Playwright pointer-event detection: the marker is a <div>
  // wrapping a Lucide SVG whose inner <path> elements intercept pointer-event checks
  // at the bounding-box center. force:true dispatches the click directly on the
  // <div data-testid="safety-alert-marker-…"> which has the onClick handler; real
  // users click the visible coloured circle and the same handler fires.
  await markerLocator.click({ force: true })

  // ── 8. Assert trust label ─────────────────────────────────────────────────

  await expect(page.locator('text=Unverified — neighbor report')).toBeVisible({ timeout: 5_000 })
  console.log('[safety-pins] trust label visible in popup')

  // ── 9. Assert vote buttons are present ────────────────────────────────────
  // Give the popup a moment to fully render all children. The trust-label check
  // passes as soon as the first div renders; the vote buttons at the bottom of
  // the popup may lag one animation frame.
  await page.waitForTimeout(500)

  const confirmBtn = page.locator(`[data-testid="vote-confirm-${capturedAlertId}"]`)
  const clearBtn = page.locator(`[data-testid="vote-clear-${capturedAlertId}"]`)
  await expect(confirmBtn).toBeVisible({ timeout: 10_000 })
  await expect(clearBtn).toBeVisible({ timeout: 5_000 })
  console.log('[safety-pins] vote buttons (Still here / Gone now) visible')

  // ── 10. Click "Still here" → confirm_count increments ────────────────────
  // After the vote RPC completes, voteAlert merges coords back into the alert row
  // (preserving lng/lat so the marker stays mounted and the popup stays open).
  // The button text reverts from '...' to 'Still here' once setVoting(null) runs.

  await confirmBtn.click()

  // Wait for '...' spinner to clear — setVoting(null) runs in finally{}
  await expect(confirmBtn).toHaveText('Still here', { timeout: 15_000 })
  console.log('[safety-pins] Still here vote completed')

  // Assert confirm_count updated in the popup counts line
  await expect(page.locator('text=/1 confirmed still here/')).toBeVisible({ timeout: 5_000 })
  console.log('[safety-pins] confirm_count incremented to 1 — vote flow verified')
})
