/**
 * vault-unlock-timeout.spec.ts — Vault unlock timeout resilience E2E
 *
 * Verifies that when the user_secure_profiles read stalls (network hang),
 * the unlock UI shows a timeout error and re-enables the submit button
 * within QUERY_TIMEOUT_MS + 5s instead of hanging indefinitely.
 *
 * Pre-fix:  spinner hangs → assertion times out → test fails (red).
 * Post-fix: VaultTimeoutError surfaces → error alert visible → submit re-enabled → test passes (green).
 *
 * Modal path (proven by pdf-annotator.spec.ts + pdf-true-edit.spec.ts):
 *   sidebar-documents → Forms tab → "Fill PDF Form" → file chooser → VaultGuard shows
 *   VaultUnlockModal automatically when vault is locked.
 *
 * Run:
 *   npx playwright test apps/web/e2e/vault-unlock-timeout.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import path from 'path'
import {
  makeAdminClient,
  provisionVaultUser,
  deleteProvisionedUser,
  type VaultProvisionResult,
} from './helpers/vault-fixture'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Must match apps/web/src/lib/vault.ts QUERY_TIMEOUT_MS
const QUERY_TIMEOUT_MS = 12_000

const VAULT_PASSWORD = 'Test-Vault-Timeout-123!'
const FIXED_TS = '20260603vaulttimeout'
const TEST_EMAIL = `e2e+vaulttimeout-${FIXED_TS}@feed.local`

// Reuse the fixture PDF written by pdf-annotator.spec.ts (guaranteed present)
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'minimal-acroform.pdf')

// Test-level timeout: QUERY_TIMEOUT_MS + 5s UI buffer + 8s setup (login + nav + file chooser).
const TEST_TIMEOUT_MS = QUERY_TIMEOUT_MS + 5_000 + 8_000

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let provision: VaultProvisionResult

// ---------------------------------------------------------------------------
// Setup/Teardown
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
    password: VAULT_PASSWORD,
    fullName: 'Timeout Test User',
    phone: '5550001111',
    residentialAddress: {
      line1: '1 Timeout Lane',
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
      console.log(`[vault-timeout] Deleted test user ${provision.userId}`)
    }
  } catch (err) {
    console.error('[vault-timeout] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test(
  'vault unlock shows timeout error and re-enables submit when DB read stalls',
  async ({ page }) => {
    // ── Login ──────────────────────────────────────────────────────────────
    await page.goto('/login')
    await page.fill('#email', provision.email)
    await page.fill('#password', provision.password)
    await page.click('button[type=submit]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })

    // ── Navigate to Forms sub-tab (proven path from pdf-annotator.spec.ts L177-196) ──
    // sidebar-documents click → Documents panel → Forms tab → vault modal
    const docsSidebarBtn = page.locator('[data-testid="sidebar-documents"]')
    await docsSidebarBtn.click()
    const formsTab = page.locator('#docs-tab-forms')
      .or(page.locator('[role="tab"]').filter({ hasText: /^Forms$/i }))
    await expect(formsTab).toBeVisible({ timeout: 10_000 })
    await formsTab.click()
    await page.waitForTimeout(500)

    // ── Click "Fill PDF Form" and supply the fixture file ──────────────────
    // VaultGuard wraps the PDF annotator — it shows VaultUnlockModal when vault
    // is locked. The modal appears immediately after the file is chosen.
    const fillPdfBtn = page.locator('button').filter({ hasText: /Fill PDF Form/i })
    await expect(fillPdfBtn).toBeVisible({ timeout: 15_000 })
    const fileChooserPromise = page.waitForEvent('filechooser')
    await fillPdfBtn.click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(FIXTURE_PDF)
    console.log(`[vault-timeout] File selected: ${FIXTURE_PDF}`)

    // ── Wait for the unlock modal to be visible BEFORE installing the stall ─
    // This ensures the stall only intercepts the unlock read triggered by
    // submitting the form, not hasVault's encryption_salt query (different column).
    const passwordInput = page.locator('[data-testid="vault-unlock-password-input"]')
    await expect(passwordInput).toBeVisible({ timeout: 15_000 })
    console.log('[vault-timeout] Vault unlock modal visible')

    // ── Install the stall AFTER the modal is visible ───────────────────────
    // The glob keys on `verification_ciphertext`, a column UNIQUE to the unlock
    // read (hasVault uses select=encryption_salt — a different column). Stalling
    // this specific route simulates a hung network on the unlock read only.
    await page.route('**/rest/v1/user_secure_profiles*verification_ciphertext*', async () => {
      // Deliberately never fulfill, continue, or abort — simulates a network hang.
      // Playwright keeps this handler alive for the life of the test.
      // vault.ts uses .retry(false) so only ONE request is ever made per unlock attempt,
      // ensuring the AbortSignal.timeout(QUERY_TIMEOUT_MS) is the sole expiry path.
    })

    // ── Fill and submit ────────────────────────────────────────────────────
    await passwordInput.fill(VAULT_PASSWORD)
    const submitBtn = page.locator('[data-testid="vault-unlock-submit-button"]')
    await submitBtn.click()
    console.log('[vault-timeout] Password submitted — waiting for timeout error...')

    // ── Assert timeout error surfaces + submit is re-enabled ───────────────
    // The error Alert should appear within QUERY_TIMEOUT_MS + 3s.
    // vault-unlock-modal.tsx ~L130-134: {error && <Alert variant="destructive">...}
    // Scope to a destructive variant alert INSIDE the dialog to avoid matching
    // unrelated toasts or setup-warning alerts elsewhere on the page.
    // vault-unlock-modal.tsx ~L130-134: {error && <Alert variant="destructive">...}
    // Scope to the dialog to avoid matching unrelated toast/notification alerts.
    const dialogEl = page.locator('[role="dialog"]').filter({ has: page.locator('[data-testid="vault-unlock-submit-button"]') })
    const errorAlert = dialogEl.locator('[role="alert"]')
    await expect(errorAlert).toBeVisible({ timeout: QUERY_TIMEOUT_MS + 3_000 })
    console.log('[vault-timeout] Error alert visible')

    // Submit button must be re-enabled (not stuck in loading state).
    // loading=false propagates synchronously in the finally block — 2s is generous.
    await expect(submitBtn).toBeEnabled({ timeout: 2_000 })

    console.log('[vault-timeout] Timeout error surfaced and submit button re-enabled — PASS')
  },
  { timeout: TEST_TIMEOUT_MS }
)
