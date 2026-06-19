/**
 * documents-subtabs.spec.ts — Documents panel subtab navigation TDD proof
 *
 * Verifies the full cycle:
 *   1. Navigate to Documents — My Documents tab active by default.
 *   2. Click My Resources → resources view active.
 *   3. Click My Documents → documents view active.
 *   4. Click Forms → forms view active.
 *   5. Click My Documents → documents view active again. (FAILS pre-fix)
 *
 * Subtab switching does NOT require vault unlock — it is purely UI state.
 * Auth is required (Documents panel is behind login + proxy redirect).
 *
 * Run:
 *   npx playwright test apps/web/e2e/documents-subtabs.spec.ts --reporter=line
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Admin client (service role)
// ---------------------------------------------------------------------------

function makeAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Ensure apps/web/.env.local is present and playwright.config.ts loads it.'
    )
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXED_TS = '20260602'
const TEST_EMAIL = `e2e+docs-subtabs-${FIXED_TS}@feed.local`
const TEST_PASSWORD = 'E2eSubtabTest!2026#'

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let userId: string

// ---------------------------------------------------------------------------
// beforeAll / afterAll
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdmin()

  // Clean up any leftover from a prior run
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) {
    await admin.auth.admin.deleteUser(prior.id)
  }

  // Create a confirmed user
  const { data: created, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (error || !created?.user) throw new Error(`beforeAll createUser failed: ${error?.message}`)
  userId = created.user.id

  // Mark onboarding complete so proxy allows through to /
  const { error: profileError } = await admin
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', userId)
  if (profileError) throw new Error(`beforeAll profile update failed: ${profileError.message}`)
})

test.afterAll(async () => {
  try {
    if (userId) {
      await admin.auth.admin.deleteUser(userId)
    }
  } catch (err) {
    console.error('[docs-subtabs] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAndOpenDocuments(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', TEST_EMAIL)
  await page.fill('#password', TEST_PASSWORD)
  await page.click('button[type="submit"]')

  // Wait for SPA root
  await page.waitForURL(/\/$|\/\?/, { timeout: 20_000 })

  // Open the Documents panel via sidebar
  const docsBtn = page.getByRole('button', { name: /documents/i }).first()
  await docsBtn.click()

  // My Documents tab should now be visible and selected
  await expect(page.getByTestId('docs-tab-documents')).toBeVisible({ timeout: 8_000 })
}

// Assert a tab is the active tab (aria-selected="true") and the others are not.
// Also asserts the correct tab-panel content is visible.
type TabKey = 'documents' | 'resources' | 'applications'

async function assertTabActive(page: Page, active: TabKey): Promise<void> {
  // aria-selected assertions
  await expect(page.getByTestId('docs-tab-documents')).toHaveAttribute(
    'aria-selected', active === 'documents' ? 'true' : 'false'
  )
  await expect(page.getByTestId('docs-tab-resources')).toHaveAttribute(
    'aria-selected', active === 'resources' ? 'true' : 'false'
  )
  await expect(page.getByTestId('docs-tab-applications')).toHaveAttribute(
    'aria-selected', active === 'applications' ? 'true' : 'false'
  )

  // Content assertions: each panel has a role="tabpanel" with the matching id
  const activePanel = page.locator(`[role="tabpanel"][id="docs-panel-${active}"]`)
  await expect(activePanel).toBeVisible({ timeout: 5_000 })
}

// ---------------------------------------------------------------------------
// Test: Full subtab navigation cycle
// ---------------------------------------------------------------------------

test.describe('Documents subtab navigation', () => {
  test('full cycle: default → resources → documents → applications → documents', async ({ page }) => {
    await loginAndOpenDocuments(page)

    // Step 1: My Documents is active by default
    await assertTabActive(page, 'documents')

    // Step 2: Click My Resources → resources view
    await page.getByTestId('docs-tab-resources').click()
    await assertTabActive(page, 'resources')

    // Step 3: Click My Documents → documents view
    await page.getByTestId('docs-tab-documents').click()
    await assertTabActive(page, 'documents')

    // Step 4: Click Applications → applications view (renders FormsPanel hub)
    await page.getByTestId('docs-tab-applications').click()
    await assertTabActive(page, 'applications')

    // Step 5: Click My Documents → documents view again
    await page.getByTestId('docs-tab-documents').click()
    await assertTabActive(page, 'documents')
  })
})
