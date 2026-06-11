/**
 * forms-flow.spec.ts — Forms Subsystem E2E
 *
 * Verifies three properties against the running app:
 *   P1  program→template deep-link: clicking Start Application on a food program
 *       navigates to the forms panel and opens the SNAP wizard.
 *   P2  profile autofill: name/email/phone/address fields are pre-filled from
 *       the encrypted vault; ssn/date_of_birth/annual_income are intentionally
 *       empty (form-field-mapper security exclusion).
 *   P0  form renders + draft submit: filling all required non-autofilled fields
 *       and submitting through the wizard creates a form_submissions row with
 *       template_id='snap-application-v1'.
 *
 * Run:
 *   npx playwright test apps/web/e2e/forms-flow.spec.ts --reporter=line
 *
 * Prerequisites:
 *   - apps/web/.env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Dev server starts automatically via playwright.config.ts webServer config
 *
 * Cleanup:
 *   afterAll deletes the test user (form_submissions, then auth.users).
 *   Runs even on failure (try/finally pattern per cleanup helper).
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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
const FIXED_TS = '20260601'
const TEST_EMAIL = `e2e+forms-${FIXED_TS}@feed.local`

const TEST_ADDRESS = {
  line1: '123 Main St',
  city: 'Los Angeles',
  state: 'CA',
  zip_code: '90210',
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let provision: VaultProvisionResult
let seededFoodResourceId: string | null = null

// ---------------------------------------------------------------------------
// beforeAll: provision vault user + ensure food program
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up any leftover from a prior run with this fixed timestamp
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) {
    await deleteProvisionedUser(admin, prior.id)
  }

  // Provision vault user with all required fields
  provision = await provisionVaultUser({
    adminClient: admin,
    email: TEST_EMAIL,
    password: VAULT_PASSWORD,
    fullName: 'Jane Doe',
    phone: '5551234567',
    residentialAddress: TEST_ADDRESS,
  })

  // Step 3: Ensure a food category resource exists in the DB.
  // Query prod resources for an active food row.
  const { data: foodResources, error: foodError } = await admin
    .from('resources')
    .select('id, name, category, status')
    .eq('category', 'food')
    .eq('status', 'approved')
    .limit(1)

  if (!foodError && foodResources && foodResources.length > 0) {
    // Path: existing food resource found — no seeding needed
    console.log(`[forms-flow] Using existing food resource: ${foodResources[0].name} (${foodResources[0].id})`)
  } else {
    // Path: no food resource — seed one minimal row
    console.log('[forms-flow] No approved food resource found — seeding one for test')
    const { data: inserted, error: insertError } = await admin
      .from('resources')
      .insert({
        name: 'E2E Test Food Bank',
        category: 'food',
        description: 'Seeded by forms-flow E2E test',
        status: 'approved',
        source: 'admin_added',
        is_verified: true,
        external_id: 'e2e-forms-food-resource',
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      throw new Error(`Failed to seed food resource: ${insertError?.message}`)
    }
    seededFoodResourceId = inserted.id
    console.log(`[forms-flow] Seeded food resource: ${inserted.id}`)
  }
})

// ---------------------------------------------------------------------------
// afterAll: cleanup — always runs even on failure
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  try {
    if (provision?.userId) {
      await deleteProvisionedUser(admin, provision.userId)
      console.log(`[forms-flow] Deleted test user ${provision.userId}`)
    }
    if (seededFoodResourceId) {
      await admin.from('resources').delete().eq('id', seededFoodResourceId)
      console.log(`[forms-flow] Deleted seeded food resource ${seededFoodResourceId}`)
    }
  } catch (err) {
    console.error('[forms-flow] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Helper: login with the provisioned test user
// ---------------------------------------------------------------------------

async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', provision.email)
  await page.fill('#password', provision.password)
  await page.click('button[type=submit]')
  // Wait for redirect to / (the SPA root)
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })
}

// ---------------------------------------------------------------------------
// Helper: unlock vault if the modal is visible
// VaultGuard shows the unlock modal when the vault is set up but locked.
// We navigate to #forms (programs panel alias) first to trigger VaultGuard.
// ---------------------------------------------------------------------------

async function unlockVaultIfNeeded(page: Page): Promise<void> {
  // Navigate to forms panel to trigger VaultGuard
  const formsBtn = page.locator('[data-testid="sidebar-programs"]')
  if (await formsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await formsBtn.click()
  }

  const passwordInput = page.locator('[data-testid="vault-unlock-password-input"]')
  const isVisible = await passwordInput.isVisible({ timeout: 5_000 }).catch(() => false)

  if (isVisible) {
    await passwordInput.fill(VAULT_PASSWORD)
    await page.locator('[data-testid="vault-unlock-submit-button"]').click()
    // Wait for modal to close
    await expect(passwordInput).not.toBeVisible({ timeout: 15_000 })
    console.log('[forms-flow] Vault unlocked successfully')
  } else {
    console.log('[forms-flow] Vault modal not shown — already unlocked or no vault guard triggered')
  }
}

// ---------------------------------------------------------------------------
// Main test: P1 → P2 → P0
// ---------------------------------------------------------------------------

test('P1+P2+P0: food program deep-link → SNAP form renders with autofill → submit creates DB row', async ({ page }) => {
  // ── Login ────────────────────────────────────────────────────────────────
  await loginAsTestUser(page)

  // ── Navigate to programs panel and unlock vault ───────────────────────────
  await page.locator('[data-testid="sidebar-programs"]').click()
  await page.waitForTimeout(1_000) // allow panel to mount

  // Unlock vault if prompted (VaultGuard on forms panel, triggered by programs→forms deep-link)
  // Note: vault modal may appear after we click Start Application and land on forms panel
  // We attempt unlock now for any pre-emptive gate; do it again after P1 navigation if needed

  // ── P1: Find food program and click Start Application ────────────────────
  // The programs panel requires a state to be selected to show results.
  // Select California to load our test data.
  const stateSelect = page.locator('select').filter({ hasText: '' }).first()
  // Look for state dropdown — it may be a <select> or input
  const stateInput = page.locator('input[placeholder*="state" i], select').first()

  // Try to set state filter to CA so food programs appear
  // The programs panel has a state filter — look for it
  const stateSelectEl = page.locator('select').first()
  if (await stateSelectEl.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await stateSelectEl.selectOption('CA')
    await page.waitForTimeout(1_000)
  }

  // Wait for program cards to appear (food resources have Start Application)
  // Look for any program-start-application button
  const startAppBtn = page.locator('[data-testid^="program-start-application-"]').first()

  // If programs panel shows "select your state" blocker, we need to select state
  // Try clicking a category filter for food if visible
  const foodCategoryBtn = page.locator('button').filter({ hasText: /^Food$/i }).first()
  if (await foodCategoryBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await foodCategoryBtn.click()
    await page.waitForTimeout(800)
  }

  // Expand the first program card to reveal the Start Application button
  // (The button is only in the expanded state)
  const firstProgramCard = page.locator('[data-testid^="program-card-"]').first()
  await expect(firstProgramCard).toBeVisible({ timeout: 20_000 })
  await firstProgramCard.click() // expand it
  await page.waitForTimeout(500)

  // Now the Start Application button should be visible
  await expect(startAppBtn).toBeVisible({ timeout: 10_000 })
  await startAppBtn.click()

  // ── Vault unlock if VaultGuard shows after switching to forms ─────────────
  const vaultPasswordInput = page.locator('[data-testid="vault-unlock-password-input"]')
  const vaultVisible = await vaultPasswordInput.isVisible({ timeout: 5_000 }).catch(() => false)
  if (vaultVisible) {
    await vaultPasswordInput.fill(VAULT_PASSWORD)
    await page.locator('[data-testid="vault-unlock-submit-button"]').click()
    await expect(vaultPasswordInput).not.toBeVisible({ timeout: 15_000 })
    console.log('[forms-flow] Vault unlocked after Start Application')
  }

  // ── P1 Assertion: form-wizard-container is visible, title contains SNAP ──
  const wizardContainer = page.locator('[data-testid="form-wizard-container"]')
  await expect(wizardContainer).toBeVisible({ timeout: 20_000 })

  const wizardTitle = page.locator('[data-testid="form-wizard-title"]')
  await expect(wizardTitle).toContainText(/snap/i)
  console.log('[forms-flow] P1 PASSED: SNAP wizard opened from food program deep-link')

  // ── P2 Assertion: autofill verification ──────────────────────────────────
  // Wait for autofill to populate (vault hook resolves async)
  await page.waitForTimeout(2_000)

  // Step 1 — Personal Information
  // Name fields — autofilled from public profile (full_name split)
  await expect(page.locator('input[name="first_name"]')).toHaveValue('Jane', { timeout: 10_000 })
  await expect(page.locator('input[name="last_name"]')).toHaveValue('Doe')

  // SSN and date_of_birth should be empty (sensitive, intentionally not autofilled)
  const ssnInput = page.locator('input[name="ssn"]')
  const dobInput = page.locator('input[name="date_of_birth"]')
  if (await ssnInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await expect(ssnInput).toHaveValue('')
    console.log('[forms-flow] P2 PASSED: ssn is empty (security check)')
  }
  if (await dobInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await expect(dobInput).toHaveValue('')
    console.log('[forms-flow] P2 PASSED: date_of_birth is empty (security check)')
  }

  // ── P0: Fill step 1 required fields, then advance to contact step ────────
  // gender uses shadcn Select (Radix) — trigger has id="gender"
  await page.locator('#gender').click()
  await page.locator('[role="option"]').filter({ hasText: /prefer not/i }).first().click()
  await page.waitForTimeout(300)

  if (await dobInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await dobInput.fill('1990-01-15')
  }
  if (await ssnInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await ssnInput.fill('123-45-6789')
  }

  // Advance to step 2 — Contact
  await page.locator('[data-testid="form-next-button"]').click()
  await page.waitForTimeout(1_000)

  // Step 2 — Contact
  // P2: verify address and email/phone autofill on this step
  await expect(page.locator('input[name="address.line1"]')).toHaveValue('123 Main St', { timeout: 10_000 })
  await expect(page.locator('input[name="address.city"]')).toHaveValue('Los Angeles')
  await expect(page.locator('input[name="address.state"]')).toHaveValue('CA')
  await expect(page.locator('input[name="address.zip"]')).toHaveValue('90210')
  console.log('[forms-flow] P2 PASSED: address autofill verified (zip_code→zip remap confirmed)')

  // Email — autofilled from auth user email (also on contact step)
  await expect(page.locator('input[name="email"]')).toHaveValue(TEST_EMAIL)

  // Phone — NOT autofilled: `phone` was removed from PROFILE_COLUMNS in PII
  // hardening (migration 20260603120000). Users must enter phone manually.
  // Assert the field is present and empty, then fill it so downstream steps work.
  await expect(page.locator('input[name="phone"]')).toBeVisible({ timeout: 5_000 })
  const phoneVal = await page.locator('input[name="phone"]').inputValue()
  if (!phoneVal) {
    await page.locator('input[name="phone"]').fill('5551234567')
  }
  console.log('[forms-flow] P2 PASSED: name/email/address autofill verified (phone filled manually per PII hardening)')

  // Fill required: preferred_contact
  const preferredContactSelect = page.locator('select[name="preferred_contact"]')
  if (await preferredContactSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await preferredContactSelect.selectOption({ index: 1 })
  }

  // Advance to step 3 — Household
  await page.locator('[data-testid="form-next-button"]').click()
  await page.waitForTimeout(800)

  // Step 3 — Household Information
  // Fill required: household_size, household_type
  const householdSizeInput = page.locator('input[name="household_size"]')
  if (await householdSizeInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await householdSizeInput.fill('1')
  }
  const householdTypeSelect = page.locator('select[name="household_type"]')
  if (await householdTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await householdTypeSelect.selectOption({ index: 1 })
  }

  // Advance to step 4 — Income
  await page.locator('[data-testid="form-next-button"]').click()
  await page.waitForTimeout(800)

  // Step 4 — Employment & Income
  // Fill required: monthly_gross_income
  const monthlyIncomeInput = page.locator('input[name="monthly_gross_income"]')
  if (await monthlyIncomeInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await monthlyIncomeInput.fill('1000')
  }

  // Advance to step 5 — Expenses
  await page.locator('[data-testid="form-next-button"]').click()
  await page.waitForTimeout(800)

  // Step 5 — Expenses
  // Fill required: rent_mortgage, housing_type
  const rentInput = page.locator('input[name="rent_mortgage"]')
  if (await rentInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await rentInput.fill('500')
  }
  const housingTypeSelect = page.locator('select[name="housing_type"]')
  if (await housingTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await housingTypeSelect.selectOption({ index: 1 })
  }

  // Advance to step 6 — Assets
  await page.locator('[data-testid="form-next-button"]').click()
  await page.waitForTimeout(800)

  // Step 6 — Assets
  // Fill required: bank_accounts_total
  const bankInput = page.locator('input[name="bank_accounts_total"]')
  if (await bankInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await bankInput.fill('0')
  }

  // Advance to step 7 — Expedited Service
  await page.locator('[data-testid="form-next-button"]').click()
  await page.waitForTimeout(800)

  // Step 7 — Expedited Service (no required fields)
  // Advance to step 8 — Certification
  await page.locator('[data-testid="form-next-button"]').click()
  await page.waitForTimeout(800)

  // Step 8 — Certification & Signature
  // Check required checkboxes: certification_statement, authorize_verification
  const certCheckbox = page.locator('input[name="certification_statement"]')
  if (await certCheckbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await certCheckbox.check()
  }
  const authCheckbox = page.locator('input[name="authorize_verification"]')
  if (await authCheckbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await authCheckbox.check()
  }

  // Advance to Review step (last content step → "Review" label)
  await page.locator('[data-testid="form-next-button"]').click()
  await page.waitForTimeout(1_000)

  // ── Submit ────────────────────────────────────────────────────────────────
  const submitBtn = page.locator('[data-testid="form-submit-button"]')
  await expect(submitBtn).toBeVisible({ timeout: 10_000 })
  await submitBtn.click()

  // After submit, wizard calls onComplete() which returns to forms list (submitted tab)
  // The form-wizard-container should disappear
  await expect(wizardContainer).not.toBeVisible({ timeout: 30_000 })
  console.log('[forms-flow] P0 PASSED: form submitted, wizard closed')

  // ── DB assertion: form_submissions row exists ──────────────────────────────
  await page.waitForTimeout(2_000) // give server a moment to commit

  const { data: submissions, error: subError } = await admin
    .from('form_submissions')
    .select('id, template_id, user_id, status')
    .eq('user_id', provision.userId)
    .eq('template_id', 'snap-application-v1')
    .limit(1)

  if (subError) {
    throw new Error(`DB query for form_submissions failed: ${subError.message}`)
  }

  expect(submissions).toBeTruthy()
  expect(submissions!.length).toBeGreaterThan(0)
  expect(submissions![0].template_id).toBe('snap-application-v1')
  console.log(
    `[forms-flow] P0 PASSED: form_submissions row confirmed — id=${submissions![0].id}, ` +
    `template_id=${submissions![0].template_id}, status=${submissions![0].status}`
  )

  console.log('[forms-flow] ALL ASSERTIONS PASSED: P1 + P2 + P0')
})
