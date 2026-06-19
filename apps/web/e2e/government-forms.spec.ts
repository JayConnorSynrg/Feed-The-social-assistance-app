/**
 * government-forms.spec.ts — P9-T8 Government Forms E2E
 *
 * Three assertions:
 *   (a) The Government Forms section renders the SSOT entries in the forms subtab
 *   (b) Tapping a synced form (IRS f1040s8 — ~98KB, smallest in bucket) opens the PDF annotator
 *   (c) Vault-lock behaviour: when the vault is locked the VaultGuard appears before the annotator
 *
 * Fallback: if the prod bucket is unreachable (migration pending, network issue),
 *   test (b) seeds the bucket with the e2e minimal-acroform fixture and cleans up.
 *
 * Run:
 *   npx playwright test apps/web/e2e/government-forms.spec.ts --reporter=line
 *
 * Prerequisites:
 *   - apps/web/.env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - Dev server auto-started via playwright.config.ts webServer config
 *
 * Cleanup: afterAll removes any storage objects the spec seeded + test user.
 */

import { test, expect, type Page } from '@playwright/test'
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

const VAULT_PASSWORD = 'Test-Vault-Pw-123!'
const FIXED_TS = '20260610govforms'
const TEST_EMAIL = `e2e+govforms-${FIXED_TS}@feed.local`

// IRS 1040 Schedule 8812 is the smallest form in the bucket (~98KB)
const IRS_STORAGE_PATH = 'federal/irs-f1040s8.pdf'
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'minimal-acroform.pdf')
const E2E_FALLBACK_PATH = 'e2e-test/gov-forms-fallback.pdf'

const TEST_USER = {
  fullName: 'Sam GovForms',
  phone: '5554440000',
  address: { line1: '12 Federal Way', city: 'Montpelier', state: 'VT', zip_code: '05602' },
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let provision: VaultProvisionResult
let seededFallback = false

// ---------------------------------------------------------------------------
// beforeAll: provision vault user; ensure at least one form is in the bucket
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up any leftover user from a prior run
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) await deleteProvisionedUser(admin, prior.id)

  provision = await provisionVaultUser({
    adminClient: admin,
    email: TEST_EMAIL,
    password: VAULT_PASSWORD,
    fullName: TEST_USER.fullName,
    phone: TEST_USER.phone,
    residentialAddress: TEST_USER.address,
  })

  // Check if the IRS form is already in the bucket (sync ran successfully)
  const { data: listData } = await admin.storage
    .from('government-forms')
    .list('federal', { limit: 100 })

  const irsPresent = listData?.some((obj) => obj.name === 'irs-f1040s8.pdf')

  if (!irsPresent) {
    // Fallback: upload the minimal-acroform fixture under a test path in the bucket
    // so test (b) can still exercise the download→annotator flow.
    const { createReadStream } = await import('fs')
    const { promises: fsPromises } = await import('fs')
    const fixtureBytes = await fsPromises.readFile(FIXTURE_PDF)

    const { error: upErr } = await admin.storage
      .from('government-forms')
      .upload(E2E_FALLBACK_PATH, fixtureBytes, { contentType: 'application/pdf', upsert: true })

    if (!upErr) {
      seededFallback = true
      console.log('[gov-forms spec] IRS form not in bucket — seeded fallback fixture at', E2E_FALLBACK_PATH)
    } else {
      console.warn('[gov-forms spec] Could not seed fallback, bucket may not exist yet:', upErr.message)
    }
  }
})

// ---------------------------------------------------------------------------
// afterAll: clean up seeded objects + test user
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  if (seededFallback) {
    try {
      await admin.storage.from('government-forms').remove([E2E_FALLBACK_PATH])
    } catch { /* non-fatal */ }
  }

  if (provision?.userId) {
    try {
      await deleteProvisionedUser(admin, provision.userId)
    } catch (err) {
      console.error('[gov-forms spec] afterAll user-delete error (non-fatal):', err)
    }
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', provision.email)
  await page.fill('#password', provision.password)
  await page.click('button[type=submit]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })
  console.log('[gov-forms] logged in, current URL:', page.url())
}

async function navigateToFormsSubtab(page: Page): Promise<void> {
  // Documents panel contains the FormsPanel as the Applications subtab
  const docsSidebar = page.locator('[data-testid="sidebar-documents"]')
  await docsSidebar.click()
  await expect(page.locator('[data-testid="documents-panel"]')).toBeVisible({ timeout: 10_000 })

  // Click the "Applications" subtab (which now renders FormsPanel)
  const formsTab = page.locator('[data-testid="docs-tab-applications"]')
  await expect(formsTab).toBeVisible({ timeout: 5_000 })
  await formsTab.click()

  // FormsPanel renders with data-testid="forms-panel"
  await expect(page.locator('[data-testid="forms-panel"]')).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// (a) Government Forms section renders SSOT entries in the forms subtab
// ---------------------------------------------------------------------------

test('(a) Government Forms section renders all SSOT entries in forms subtab', async ({ page }) => {
  await loginAsTestUser(page)
  await navigateToFormsSubtab(page)

  // The Government Forms section should be visible
  const govSection = page.locator('[data-testid="government-forms-section"]')
  await expect(govSection).toBeVisible({ timeout: 10_000 })

  // Should contain at least the 6 SSOT entries as gov-form-card elements
  const cards = page.locator('[data-testid="gov-form-card"]')
  await expect(cards).toHaveCount(6, { timeout: 5_000 })

  // The IRS form should be present
  await expect(page.getByText('Earned Income Tax Credit / Child Tax Credit')).toBeVisible()

  // HUD form should be present
  await expect(page.getByText('Section 8 Housing Choice Voucher Application')).toBeVisible()

  // VA form should be present
  await expect(page.getByText('VA Disability Compensation')).toBeVisible()
})

// ---------------------------------------------------------------------------
// (b) Tapping a synced form opens the PDF annotator
// ---------------------------------------------------------------------------

test('(b) Tapping a synced government form opens the PDF annotator', async ({ page }) => {
  // Extended timeout: PDF download + vault context init + unlock + annotator render
  test.setTimeout(120_000)
  
  await loginAsTestUser(page)
  await navigateToFormsSubtab(page)

  const govSection = page.locator('[data-testid="government-forms-section"]')
  await expect(govSection).toBeVisible({ timeout: 10_000 })

  // Wait for the bucket probe to finish (data-gov-forms-loaded="true")
  const govLoaded = page.locator('[data-testid="government-forms-section"][data-gov-forms-loaded="true"]')
  await expect(govLoaded).toBeVisible({ timeout: 20_000 })

  // Now check if any form has a Fill & Annotate button (bucket has PDFs)
  const anyFillBtn = page.getByRole('button', { name: /fill.*annotate/i })
  const hasFillBtn = await anyFillBtn.first().isVisible({ timeout: 2_000 }).catch(() => false)
  console.log('[test-b] bucket loaded, fill buttons visible:', hasFillBtn)
  if (!hasFillBtn) {
    console.log('[test-b] SKIP — no Fill & Annotate buttons; bucket probe returned 0 objects')
    test.skip('No synced forms in bucket — skipping annotator open assertion')
    return
  }

  // Find the card for IRS f1040s8 (in bucket) — smallest form
  const fillBtn = page.locator('[data-testid="gov-form-card"]').filter({
    has: page.getByRole('button', { name: /fill.*annotate/i }),
  }).first()

  await expect(fillBtn).toBeVisible({ timeout: 5_000 })
  await fillBtn.getByRole('button', { name: /fill.*annotate/i }).click()

  // After clicking Fill, the form downloads from storage and VaultGuard mounts.
  // VaultGuard shows a loading spinner while the vault context initialises (hasVault DB query),
  // then renders the unlock modal. This sequence can take up to 30s on a cold start.
  const passwordInput = page.locator('[data-testid="vault-unlock-password-input"]')
  // Wait for the password input to appear in the DOM (PDF download + vault init)
  const modalVisible = await expect(passwordInput).toBeVisible({ timeout: 50_000 }).then(() => true).catch(() => false)
  console.log('[test-b] vault modal visible:', modalVisible)

  if (modalVisible) {
    // Wait for the input to be enabled (vault context loading=false)
    await expect(passwordInput).toBeEnabled({ timeout: 15_000 })
    await passwordInput.fill(VAULT_PASSWORD)
    const submitBtn = page.locator('[data-testid="vault-unlock-submit-button"]')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
    await submitBtn.click()
    await expect(passwordInput).not.toBeVisible({ timeout: 30_000 })
  }

  // PDF annotator should be visible — either immediately (if vault was already unlocked
  // from a prior test) or after the vault unlock above completes.
  await expect(page.locator('[data-testid="pdf-annotator"]').first()).toBeVisible({
    timeout: 20_000,
  })
})

// ---------------------------------------------------------------------------
// (c) Vault-locked behaviour: VaultGuard appears before annotator
// ---------------------------------------------------------------------------

test('(c) VaultGuard gate appears when vault is locked before opening a gov form', async ({ page }) => {
  await loginAsTestUser(page)
  await navigateToFormsSubtab(page)

  // Do NOT unlock vault

  const govSection = page.locator('[data-testid="government-forms-section"]')
  await expect(govSection).toBeVisible({ timeout: 10_000 })

  // Wait for the bucket probe to finish
  const govLoaded2 = page.locator('[data-testid="government-forms-section"][data-gov-forms-loaded="true"]')
  await expect(govLoaded2).toBeVisible({ timeout: 20_000 })

  const anyFillBtn2 = page.getByRole('button', { name: /fill.*annotate/i })
  const hasFillBtn2 = await anyFillBtn2.first().isVisible({ timeout: 2_000 }).catch(() => false)
  if (!hasFillBtn2) {
    test.skip('No synced forms in bucket — skipping vault gate assertion')
    return
  }

  // Find a card with a Fill & Annotate button
  const fillBtn = page.locator('[data-testid="gov-form-card"]').filter({
    has: page.getByRole('button', { name: /fill.*annotate/i }),
  }).first()

  await fillBtn.getByRole('button', { name: /fill.*annotate/i }).click()

  // Either the vault unlock modal OR the "Unlock Vault" button should be visible
  // (VaultGuard shows the unlock gate before revealing the annotator)
  const vaultGate = page.locator('[data-testid="vault-unlock-password-input"], button:has-text("Unlock Vault")')
  await expect(vaultGate.first()).toBeVisible({ timeout: 15_000 })
})
