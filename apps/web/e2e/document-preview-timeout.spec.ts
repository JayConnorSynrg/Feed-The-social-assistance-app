/**
 * document-preview-timeout.spec.ts - Document download/preview timeout resilience E2E
 *
 * Verifies that when a network stall occurs during document View or Download:
 *   Test A: storage object request stalls - error surfaces + View button re-enables
 *   Test B: metadata DB read stalls - error surfaces + View button re-enables
 *
 * Pre-fix:  finally{setIsDownloading(false)} never runs - spinner sticks - test FAILS.
 * Post-fix: AbortSignal.timeout fires - isQueryTimeout detected - setError called -
 *           finally{setDownloadingId(null)} runs - button re-enables - test PASSES.
 *
 * Vault unlock strategy:
 *   The test checks if the vault is already unlocked (IndexedDB DEK present from a
 *   prior run). If not, it clicks the Forms subtab which triggers VaultGuard. Either
 *   way, once vault IS unlocked, the stall is installed and View is clicked.
 *
 * Seeding: admin client inserts a user_documents row with valid base64 IV placeholders.
 * The stall fires before decryption so the fake IV values never matter for Test A.
 * For Test B the stall fires before the storage call is even attempted.
 *
 * Run:
 *   npx playwright test apps/web/e2e/document-preview-timeout.spec.ts --reporter=line
 */

import { test, expect, type Page } from '@playwright/test'
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

// Must match apps/web/src/lib/vault.ts QUERY_TIMEOUT_MS
const QUERY_TIMEOUT_MS = 12_000

const VAULT_PASSWORD = 'Test-DocTimeout-123!'
const FIXED_TS = '20260603doctimeout'
const TEST_EMAIL = `e2e+doctimeout-${FIXED_TS}@feed.local`

// Per-test timeout: QUERY_TIMEOUT_MS + 5s UI buffer + 30s setup
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
    password: VAULT_PASSWORD,
    fullName: 'DocTimeout Test User',
    phone: '5550002222',
    residentialAddress: {
      line1: '2 Timeout Ave',
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
      console.log(`[doc-timeout] Deleted test user ${provision.userId}`)
    }
  } catch (err) {
    console.error('[doc-timeout] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed a minimal encrypted document row that will appear in the panel list. */
async function seedDocRow(userId: string, name: string): Promise<string> {
  const { data, error } = await admin
    .from('user_documents')
    .insert({
      user_id: userId,
      name,
      document_type: 'other',
      category: 'other',
      file_path: `${userId}/fake-timeout-${Date.now()}.encrypted`,
      file_size: 1024,
      mime_type: 'application/pdf',
      // Syntactically valid base64 placeholders - never decrypted (stall fires first)
      encryption_iv: 'AAAAAAAAAAAAAAAA',
      encrypted_original_name: 'AAAAAAAAAAAAAAAA',
      encrypted_name_iv: 'AAAAAAAAAAAAAAAA',
      original_size: 1024,
      is_encrypted: true,
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`seedDocRow failed: ${error?.message}`)
  }
  return data.id
}

/**
 * Login, navigate to Documents panel, and wait for the document list to load.
 */
async function loginAndNavigateToDocs(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', TEST_EMAIL)
  await page.fill('#password', VAULT_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })
  console.log('[doc-timeout] Logged in')

  const docsSidebarBtn = page.locator('[data-testid="sidebar-documents"]')
  await docsSidebarBtn.click()
  await expect(
    page.locator('[data-testid="docs-tab-documents"]')
  ).toBeVisible({ timeout: 10_000 })
  console.log('[doc-timeout] Documents panel visible')
}

/**
 * Ensure the vault is unlocked before proceeding.
 *
 * Clicks the View button on the first doc. If the vault is locked, the
 * documents-panel shows VaultUnlockModal. We fill + submit it to unlock.
 * After onSuccess fires (isUnlockedRef.current set to true synchronously),
 * handleView retries - but we DON'T wait for that download (it may succeed
 * or fail on the fake data). We just need vault unlocked.
 *
 * If vault is already unlocked, View triggers the download directly. We wait
 * for the download to settle (succeed or error), then clear any error shown.
 */
async function ensureVaultUnlocked(page: Page): Promise<void> {
  const viewBtn = page.locator('[data-testid="doc-view-btn"]').first()
  await expect(viewBtn).toBeEnabled({ timeout: 5_000 })
  await viewBtn.click()
  console.log('[doc-timeout] View clicked - checking if vault modal appears')

  const passwordInput = page.locator('[data-testid="vault-unlock-password-input"]')

  // Wait up to 5s for the unlock modal. If vault is locked, it appears promptly.
  const modalVisible = await page
    .waitForSelector('[data-testid="vault-unlock-password-input"]', { state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false)

  if (modalVisible) {
    console.log('[doc-timeout] Vault unlock modal visible - filling password')
    await passwordInput.fill(VAULT_PASSWORD)
    await page.locator('[data-testid="vault-unlock-submit-button"]').click()
    // onSuccess: isUnlockedRef.current set true synchronously, handleView retried.
    // Wait for the modal to close.
    await expect(passwordInput).not.toBeVisible({ timeout: 15_000 })
    console.log('[doc-timeout] Vault unlocked - handleView retry in progress')
    // Brief wait for the retry download attempt to settle (may error on fake data)
    await page.waitForTimeout(2_000)
  } else {
    // Vault already unlocked - download attempt started directly.
    // Wait for it to complete (success or error on fake data).
    await page.waitForTimeout(3_000)
  }

  // Clear any download error shown by the first attempt
  const dismissBtn = page.locator('[data-testid="doc-download-error"] button')
  if (await page.waitForSelector('[data-testid="doc-download-error"]', { state: 'visible', timeout: 1_500 }).then(() => true).catch(() => false)) {
    await dismissBtn.click().catch(() => {})
    console.log('[doc-timeout] Cleared first-attempt error')
  }

  // Close viewer if it opened
  if (await page.waitForSelector('[data-testid="document-viewer"]', { state: 'visible', timeout: 1_000 }).then(() => true).catch(() => false)) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  console.log('[doc-timeout] Vault IS unlocked - ready for stall test')
}

// ---------------------------------------------------------------------------
// Shared assertion: install stall, click View, assert error + re-enable
// ---------------------------------------------------------------------------

async function runTimeoutAssertion(
  page: Page,
  stallPattern: string,
  label: string
): Promise<void> {
  await page.route(stallPattern, async () => {
    // Never fulfill - simulates a permanent network hang
  })
  console.log(`[doc-timeout] ${label} stall installed - clicking View...`)

  const viewBtn = page.locator('[data-testid="doc-view-btn"]').first()
  await expect(viewBtn).toBeEnabled({ timeout: 5_000 })
  await viewBtn.click()
  console.log(`[doc-timeout] View clicked - waiting for timeout error (up to ${QUERY_TIMEOUT_MS + 3000}ms)...`)

  // Assert: error banner appears within QUERY_TIMEOUT_MS + 3s
  const errorBanner = page.locator('[data-testid="doc-download-error"]')
  await expect(errorBanner).toBeVisible({ timeout: QUERY_TIMEOUT_MS + 3_000 })
  console.log('[doc-timeout] Error banner visible')

  // Assert: View button re-enabled (finally{setDownloadingId(null)} ran)
  await expect(viewBtn).toBeEnabled({ timeout: 2_000 })
  console.log(`[doc-timeout] View button re-enabled - ${label} stall PASS`)

  // Assert: user-facing message
  await expect(errorBanner).toContainText(/timed out|connection|retry/i)
}

// ---------------------------------------------------------------------------
// Test A - storage object stall
//
// downloadFile: metadata read succeeds (not stalled), then storage.download
// hits the stall. AbortSignal.timeout(QUERY_TIMEOUT_MS) fires.
// ---------------------------------------------------------------------------

test(
  'A: storage stall shows timeout error and re-enables View button',
  async ({ page }) => {
    const docId = await seedDocRow(provision.userId, 'stall-storage-test.pdf')
    console.log(`[doc-timeout] Seeded doc row ${docId}`)

    page.on('console', (msg) => {
      if (msg.type() === 'error' || /vault|download|timeout/i.test(msg.text())) {
        console.log(`[browser][${msg.type()}] ${msg.text().slice(0, 200)}`)
      }
    })

    try {
      await loginAndNavigateToDocs(page)
      await expect(page.locator('[data-testid="doc-view-btn"]').first()).toBeVisible({ timeout: 10_000 })
      await ensureVaultUnlocked(page)
      await expect(page.locator('[data-testid="doc-view-btn"]').first()).toBeVisible({ timeout: 10_000 })
      await runTimeoutAssertion(page, '**/storage/v1/object/**', 'storage')
    } finally {
      await admin.from('user_documents').delete().eq('id', docId).then(() => {}).catch(() => {})
    }
  },
  { timeout: TEST_TIMEOUT_MS }
)

// ---------------------------------------------------------------------------
// Test B - metadata DB read stall
//
// downloadFile's FIRST step reads user_documents (.single() metadata fetch).
// That read hits the stall. Timeout fires before storage is ever reached.
// ---------------------------------------------------------------------------

test(
  'B: metadata DB stall shows timeout error and re-enables View button',
  async ({ page }) => {
    const docId = await seedDocRow(provision.userId, 'stall-metadata-test.pdf')
    console.log(`[doc-timeout] Seeded doc row ${docId}`)

    page.on('console', (msg) => {
      if (msg.type() === 'error' || /vault|download|timeout/i.test(msg.text())) {
        console.log(`[browser][${msg.type()}] ${msg.text().slice(0, 200)}`)
      }
    })

    try {
      await loginAndNavigateToDocs(page)
      await expect(page.locator('[data-testid="doc-view-btn"]').first()).toBeVisible({ timeout: 10_000 })
      await ensureVaultUnlocked(page)
      await expect(page.locator('[data-testid="doc-view-btn"]').first()).toBeVisible({ timeout: 10_000 })
      await runTimeoutAssertion(page, '**/rest/v1/user_documents*', 'metadata')
    } finally {
      await admin.from('user_documents').delete().eq('id', docId).then(() => {}).catch(() => {})
    }
  },
  { timeout: TEST_TIMEOUT_MS }
)
