/**
 * documents-upload-locked-card.spec.ts
 *
 * Asserts that clicking the "Vault Locked" EncryptedUpload card body (anywhere,
 * not just the inner button) opens the VaultUnlockModal.
 *
 * Bug reproduced (before Change A): the card wrapper had no onClick — only the
 * inner "Unlock Vault" button was wired. Clicking the card body silently did
 * nothing, giving users no visual response to clicking the Upload area.
 *
 * Test strategy:
 *   1. Log in with a provisioned vault user (vault starts LOCKED — fresh session,
 *      no saved DEK in IndexedDB for a headless browser).
 *   2. Navigate to the Documents panel My Documents tab.
 *   3. Click the vault-locked card OUTSIDE the inner "Unlock Vault" button (i.e.,
 *      on the card padding / icon area) to exercise the wrapper onClick.
 *   4. Assert the VaultUnlockModal password input is visible.
 *
 * RED without Change A (card wrapper has no onClick → modal never opens).
 * GREEN with Change A (wrapper onClick → setShowUnlockModal(true) → modal opens).
 *
 * Run:
 *   npx playwright test apps/web/e2e/documents-upload-locked-card.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  makeAdminClient,
  provisionVaultUser,
  deleteProvisionedUser,
  type VaultProvisionResult,
} from './helpers/vault-fixture'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VAULT_PASSWORD = 'Test-Upload-Card-123!'
const FIXED_TS = '20260604uploadcard'
const TEST_EMAIL = `e2e+uploadcard-${FIXED_TS}@feed.local`

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

  // Clean up any prior run with this fixed identifier
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) {
    await deleteProvisionedUser(admin, prior.id)
  }

  provision = await provisionVaultUser({
    adminClient: admin,
    email: TEST_EMAIL,
    password: VAULT_PASSWORD,
    fullName: 'Upload Card Test User',
    phone: '5550002222',
    residentialAddress: {
      line1: '2 Upload Lane',
      city: 'Austin',
      state: 'TX',
      zip_code: '73301',
    },
  })
})

test.afterAll(async () => {
  try {
    if (provision?.userId) {
      await deleteProvisionedUser(admin, provision.userId)
    }
  } catch (err) {
    console.error('[upload-card] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test(
  'clicking the vault-locked upload card body opens the VaultUnlockModal',
  async ({ page }) => {
    // ── Login ────────────────────────────────────────────────────────────────
    await page.goto('/login')
    await page.fill('#email', provision.email)
    await page.fill('#password', provision.password)
    await page.click('button[type=submit]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })

    // ── Navigate to Documents panel → My Documents tab ────────────────────
    const docsSidebarBtn = page.locator('[data-testid="sidebar-documents"]')
    await docsSidebarBtn.click()

    // Ensure the My Documents tab is active (it is the default)
    const docsTab = page.locator('#docs-tab-documents')
      .or(page.locator('[role="tab"]').filter({ hasText: /My Documents/i }))
    await expect(docsTab).toBeVisible({ timeout: 10_000 })
    await docsTab.click()

    // ── Verify the locked card is rendered ────────────────────────────────
    // The card shows "Vault Locked" heading when isUnlocked=false
    const lockedHeading = page.locator('h3').filter({ hasText: /Vault Locked/i })
    await expect(lockedHeading).toBeVisible({ timeout: 10_000 })
    console.log('[upload-card] Vault Locked card visible')

    // ── Click the card wrapper (NOT the inner button) ─────────────────────
    // Target the Lock icon (inside the orange circle) which is part of the card
    // body but clearly outside the "Unlock Vault" button element.
    // This exercises the wrapper onClick added by Change A.
    const lockIcon = page.locator('h3').filter({ hasText: /Vault Locked/i })
      .locator('..') // parent flex container
      .locator('div').first() // the orange icon circle
    await lockIcon.click({ force: true })
    console.log('[upload-card] Clicked card body (lock icon area)')

    // ── Assert the VaultUnlockModal opened ────────────────────────────────
    const passwordInput = page.locator('[data-testid="vault-unlock-password-input"]')
    await expect(passwordInput).toBeVisible({ timeout: 8_000 })
    console.log('[upload-card] VaultUnlockModal opened — PASS')
  },
  { timeout: 60_000 }
)

test(
  'clicking the inner "Unlock Vault" button still opens the VaultUnlockModal',
  async ({ page }) => {
    // ── Login ────────────────────────────────────────────────────────────────
    await page.goto('/login')
    await page.fill('#email', provision.email)
    await page.fill('#password', provision.password)
    await page.click('button[type=submit]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })

    // ── Navigate to Documents panel → My Documents tab ────────────────────
    const docsSidebarBtn = page.locator('[data-testid="sidebar-documents"]')
    await docsSidebarBtn.click()

    const docsTab = page.locator('#docs-tab-documents')
      .or(page.locator('[role="tab"]').filter({ hasText: /My Documents/i }))
    await expect(docsTab).toBeVisible({ timeout: 10_000 })
    await docsTab.click()

    const lockedHeading = page.locator('h3').filter({ hasText: /Vault Locked/i })
    await expect(lockedHeading).toBeVisible({ timeout: 10_000 })

    // ── Click the inner "Unlock Vault" button ─────────────────────────────
    const unlockBtn = page.locator('button').filter({ hasText: /Unlock Vault/i })
    await expect(unlockBtn).toBeVisible({ timeout: 5_000 })
    await unlockBtn.click()

    // ── Assert modal opened (no double-fire / stop-propagation regression) ─
    const passwordInput = page.locator('[data-testid="vault-unlock-password-input"]')
    await expect(passwordInput).toBeVisible({ timeout: 8_000 })
    console.log('[upload-card] Inner button click still opens modal — PASS')
  },
  { timeout: 60_000 }
)
