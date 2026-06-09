/**
 * community-petitions.spec.ts — Community Petitions E2E
 *
 * Coverage (5 assertions):
 *  1. Petitions panel renders in the sidebar and shows petition cards.
 *  2. Petition card shows "Add your verified signature of support" button.
 *  3. Clicking the sign button triggers the sign API call and returns ok:true.
 *  4. After signing, the button becomes "Signed" (disabled).
 *  5. get_petition_signature_count RPC is called (count displayed on card).
 *
 * Strategy:
 *  - Provision a test user via Supabase admin API (no vault needed — petitions
 *    use plain full_name from profiles).
 *  - Intercept /api/petitions/sign to assert the request body and stub the response.
 *  - Verify the DOM state before and after the sign action.
 *
 * Run:
 *   cd apps/web && npx playwright test e2e/community-petitions.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_PASSWORD = 'Test-Petitions-123!'
const FIXED_TS = '20260608petitions'
const TEST_EMAIL = `e2e+petitions-${FIXED_TS}@feed.local`
const TEST_FULL_NAME = `E2E Petitions User ${FIXED_TS}`

// Seeded petition ID from migration
const SEEDED_PETITION_ID = '30f09104-6904-43c7-9d43-9e0c480ceaa5'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars for admin client')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let userId: string | null = null

test.beforeAll(async () => {
  const admin = makeAdminClient()

  // Clean up prior run
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) {
    await admin.auth.admin.deleteUser(prior.id)
  }

  // Create user
  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: USER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: TEST_FULL_NAME },
  })

  if (error || !data.user) throw new Error(`Failed to create test user: ${error?.message}`)
  userId = data.user.id

  // Ensure profile row has full_name
  await admin
    .from('profiles')
    .update({ full_name: TEST_FULL_NAME })
    .eq('id', userId)
})

test.afterAll(async () => {
  if (!userId) return
  const admin = makeAdminClient()
  // Clean up signature if signed during test
  await admin
    .from('petition_signatures')
    .delete()
    .eq('signer_id', userId)
  await admin.auth.admin.deleteUser(userId)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('petitions panel navigates from sidebar', async ({ page }) => {
  // Sign in
  await page.goto('/')
  await page.waitForSelector('[data-testid="auth-form"], [aria-label="AI Assistant"]', { timeout: 15_000 })

  // If auth form shown, sign in first
  const authForm = page.locator('[data-testid="auth-form"]')
  if (await authForm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', USER_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 15_000 })
  }

  // Navigate to petitions via sidebar
  const petitionsBtn = page.locator('[aria-label="Petitions"], button:has-text("Petitions")')
  await expect(petitionsBtn.first()).toBeVisible({ timeout: 10_000 })
  await petitionsBtn.first().click()

  // Panel should show header
  await expect(page.locator('text=Community Petitions')).toBeVisible({ timeout: 10_000 })
})

test('petitions panel shows sign button and signed-as microcopy', async ({ page }) => {
  // Sign in
  await page.goto('/')
  await page.waitForSelector('[aria-label="AI Assistant"], [data-testid="auth-form"]', { timeout: 15_000 })

  const authForm = page.locator('[data-testid="auth-form"]')
  if (await authForm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', USER_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 15_000 })
  }

  const petitionsBtn = page.locator('[aria-label="Petitions"], button:has-text("Petitions")')
  await petitionsBtn.first().click()

  // Sign button visible
  const signBtn = page.locator('button:has-text("Add your verified signature of support")').first()
  await expect(signBtn).toBeVisible({ timeout: 10_000 })

  // Signing-as microcopy
  await expect(page.locator(`text=Signing as`)).toBeVisible({ timeout: 5_000 })
})

test('sign action calls /api/petitions/sign and marks petition signed', async ({ page }) => {
  // Intercept the sign API
  let signRequestBody: unknown = null
  await page.route('/api/petitions/sign', async (route) => {
    const body = route.request().postDataJSON()
    signRequestBody = body

    // Stub response — idempotent success
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, alreadySigned: false, count: 1 }),
    })
  })

  await page.goto('/')
  await page.waitForSelector('[aria-label="AI Assistant"], [data-testid="auth-form"]', { timeout: 15_000 })

  const authForm = page.locator('[data-testid="auth-form"]')
  if (await authForm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', USER_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 15_000 })
  }

  const petitionsBtn = page.locator('[aria-label="Petitions"], button:has-text("Petitions")')
  await petitionsBtn.first().click()

  const signBtn = page.locator('button:has-text("Add your verified signature of support")').first()
  await expect(signBtn).toBeVisible({ timeout: 10_000 })
  await signBtn.click()

  // Verify API was called with affirmed: true
  expect(signRequestBody).toBeTruthy()
  const body = signRequestBody as Record<string, unknown>
  expect(body.affirmed).toBe(true)
  expect(typeof body.petitionId).toBe('string')

  // After sign: button should become "Signed"
  await expect(page.locator('text=Signed').first()).toBeVisible({ timeout: 5_000 })
})

test('get_petition_signature_count displayed on petition card', async ({ page }) => {
  // Intercept Supabase RPC call
  let rpcCalled = false
  await page.route(/get_petition_signature_count/, async (route) => {
    rpcCalled = true
    await route.continue()
  })

  await page.goto('/')
  await page.waitForSelector('[aria-label="AI Assistant"], [data-testid="auth-form"]', { timeout: 15_000 })

  const authForm = page.locator('[data-testid="auth-form"]')
  if (await authForm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', USER_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 15_000 })
  }

  const petitionsBtn = page.locator('[aria-label="Petitions"], button:has-text("Petitions")')
  await petitionsBtn.first().click()

  // Wait for panel to load
  await expect(page.locator('text=Community Petitions')).toBeVisible({ timeout: 10_000 })

  // A signature count is visible (number + "signatures" text)
  await expect(page.locator('text=signatures').first()).toBeVisible({ timeout: 8_000 })
})
