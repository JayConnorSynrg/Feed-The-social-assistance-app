/**
 * saved-resources-encryption.spec.ts — Wave-3 Saved-Resources Encryption E2E
 *
 * Proves zero-knowledge-at-rest for the saved_resources.notes field end-to-end
 * against the hosted Supabase project:
 *
 *   (a) CIPHERTEXT AT REST — after the UI saves notes, a Management-API SELECT
 *       confirms encrypted_notes is populated and the plaintext notes column is
 *       NULL (no plaintext leak in the database).
 *   (b) DECRYPTED IN UI — the dialog renders the original cleartext notes after
 *       the vault is unlocked (round-trip succeeds).
 *   (c) LOCKED HIDES PLAINTEXT — after locking the vault and reopening the
 *       dialog, the cleartext notes do NOT appear in the DOM (VaultGuard gates
 *       the encrypted surface).
 *
 * Run:
 *   npx playwright test apps/web/e2e/saved-resources-encryption.spec.ts --reporter=line
 *
 * Cleanup:
 *   afterAll deletes the saved_resources row (children cascade) then the test
 *   user. Runs even on failure.
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  makeAdminClient,
  provisionVaultUser,
  deleteProvisionedUser,
  type VaultProvisionResult,
} from './helpers/vault-fixture'

const VAULT_PASSWORD = 'Test-Vault-Pw-123!'
const FIXED_TS = '20260611'
const TEST_EMAIL = `e2e+savedres-${FIXED_TS}@feed.local`
const SECRET_NOTES = `private-note-${FIXED_TS}-confidential`

const TEST_ADDRESS = {
  line1: '123 Main St',
  city: 'Los Angeles',
  state: 'CA',
  zip_code: '90210',
}

// Management-API SQL endpoint — used for ciphertext-at-rest assertion. The REST
// client is RLS-scoped to the auth user; the Management API reads as the project
// owner, which is the only way to inspect the raw stored columns.
const MGMT_SQL_URL =
  'https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query'

let admin: SupabaseClient
let provision: VaultProvisionResult
let savedResourceId: string | null = null

async function mgmtQuery(sql: string): Promise<Array<Record<string, unknown>>> {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) {
    throw new Error('SUPABASE_ACCESS_TOKEN missing — required for ciphertext-at-rest assertion.')
  }
  const res = await fetch(MGMT_SQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'feed-ops/1.0',
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    throw new Error(`Management API query failed (${res.status}): ${await res.text()}`)
  }
  return (await res.json()) as Array<Record<string, unknown>>
}

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up any leftover from a prior run with this fixed timestamp.
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) {
    await admin.from('saved_resources').delete().eq('user_id', prior.id)
    await deleteProvisionedUser(admin, prior.id)
  }

  provision = await provisionVaultUser({
    adminClient: admin,
    email: TEST_EMAIL,
    password: VAULT_PASSWORD,
    fullName: 'Vault Tester',
    phone: '5559876543',
    residentialAddress: TEST_ADDRESS,
  })

  // Seed a saved resource (public listing fields cleartext, no notes yet).
  const { data: inserted, error: insErr } = await admin
    .from('saved_resources')
    .insert({
      user_id: provision.userId,
      resource_name: 'E2E Encryption Test Pantry',
      resource_category: 'food',
      resource_address: '500 Public Ave, Burlington, VT',
      resource_phone: '8025551212',
    })
    .select('id')
    .single()
  if (insErr || !inserted) {
    throw new Error(`Failed to seed saved_resource: ${insErr?.message}`)
  }
  savedResourceId = inserted.id
})

test.afterAll(async () => {
  try {
    if (savedResourceId) {
      await admin.from('saved_resources').delete().eq('id', savedResourceId)
    }
    if (provision?.userId) {
      await admin.from('saved_resources').delete().eq('user_id', provision.userId)
      await deleteProvisionedUser(admin, provision.userId)
    }
  } catch (err) {
    console.error('[saved-res-enc] afterAll cleanup error (non-fatal):', err)
  }
})

async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', provision.email)
  await page.fill('#password', provision.password)
  await page.click('button[type=submit]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })
}

/**
 * Unlock the vault when the VaultGuard modal appears.
 * @param required when true, wait up to 20s for the modal (first locked open
 *        always shows it after VaultGuard's loading spinner resolves); when
 *        false, only act if the modal is already present.
 */
async function unlockVaultModalIfShown(page: Page, required = false): Promise<void> {
  const passwordInput = page.locator('[data-testid="vault-unlock-password-input"]')
  const appearTimeout = required ? 25_000 : 6_000
  // Wait for the modal to be ATTACHED first (VaultGuard mounts it after its
  // own loading state resolves), then for it to become actually visible. Using
  // waitFor('attached') avoids a race where isVisible() polls before the Radix
  // enter animation flips the element visible.
  try {
    await passwordInput.waitFor({ state: 'attached', timeout: appearTimeout })
    await passwordInput.waitFor({ state: 'visible', timeout: 10_000 })
  } catch {
    if (required) throw new Error('Expected vault unlock modal to appear but it did not.')
    return
  }
  // Fill and submit; the submit button enables once the field is non-empty.
  await passwordInput.fill(VAULT_PASSWORD)
  const submit = page.locator('[data-testid="vault-unlock-submit-button"]')
  await expect(submit).toBeEnabled({ timeout: 5_000 })
  await submit.click()
  await expect(passwordInput).not.toBeVisible({ timeout: 15_000 })
}

test('saved-resources notes: write→ciphertext-at-rest→decrypt-in-UI→locked-hides', async ({ page }) => {
  // ── Login ──
  await loginAsTestUser(page)

  // ── Navigate to Documents → My Resources subtab ──
  await page.locator('[data-testid="sidebar-documents"]').click()
  await page.waitForTimeout(1_000)
  await page.locator('[data-testid="docs-tab-resources"]').click()
  await page.waitForTimeout(800)

  // ── Open the seeded resource (expand its category, then click the row) ──
  const resourceRow = page.locator(`[data-testid="saved-resource-${savedResourceId}"]`)
  // The list is grouped by category in collapsed accordions — expand the group
  // containing our resource if the row isn't already visible.
  if (!(await resourceRow.isVisible({ timeout: 2_000 }).catch(() => false))) {
    // Click each category header until our row appears.
    const headers = page.locator('button:has-text("food"), button:has-text("Food")')
    const count = await headers.count()
    for (let i = 0; i < count; i++) {
      await headers.nth(i).click().catch(() => {})
      if (await resourceRow.isVisible({ timeout: 1_500 }).catch(() => false)) break
    }
  }
  await expect(resourceRow).toBeVisible({ timeout: 10_000 })
  await resourceRow.click()

  // ── VaultGuard inside the dialog prompts an unlock — unlock it (required) ──
  await unlockVaultModalIfShown(page, true)

  // ── Write notes ──
  const notesTextarea = page.locator('textarea[placeholder*="notes about this resource" i]')
  await expect(notesTextarea).toBeVisible({ timeout: 15_000 })
  await notesTextarea.fill(SECRET_NOTES)
  await page.locator('button:has-text("Save Notes")').click()
  // "Saved" confirmation appears after the encrypted write commits.
  await expect(page.locator('text=Saved').first()).toBeVisible({ timeout: 15_000 })

  // ── (a) CIPHERTEXT AT REST — Management-API SELECT ──
  await page.waitForTimeout(1_500) // allow the encrypted write to commit
  const rows = await mgmtQuery(
    `SELECT notes, encrypted_notes, notes_iv, resource_name, resource_address, resource_phone, resource_category ` +
    `FROM public.saved_resources WHERE id = '${savedResourceId}';`
  )
  expect(rows.length).toBe(1)
  const row = rows[0]
  // plaintext NULLed
  expect(row.notes).toBeNull()
  // ciphertext + iv populated
  expect(typeof row.encrypted_notes).toBe('string')
  expect((row.encrypted_notes as string).length).toBeGreaterThan(0)
  expect(typeof row.notes_iv).toBe('string')
  expect((row.notes_iv as string).length).toBeGreaterThan(0)
  // the secret cleartext must NOT appear inside the stored ciphertext
  expect(row.encrypted_notes as string).not.toContain(SECRET_NOTES)
  console.log('[saved-res-enc] (a) PASS: ciphertext at rest, plaintext notes NULL')

  // ── (d) PUBLIC FIELDS STAY CLEARTEXT + SEARCHABLE (no regression) ──
  expect(row.resource_name).toBe('E2E Encryption Test Pantry')
  expect(row.resource_address).toBe('500 Public Ave, Burlington, VT')
  expect(row.resource_phone).toBe('8025551212')
  expect(row.resource_category).toBe('food')
  // Cleartext means an ILIKE search on the public column still matches.
  const search = await mgmtQuery(
    `SELECT id FROM public.saved_resources WHERE id = '${savedResourceId}' AND resource_name ILIKE '%Encryption Test%';`
  )
  expect(search.length).toBe(1)
  console.log('[saved-res-enc] (d) PASS: public fields cleartext + searchable')

  // ── (b) DECRYPTED IN UI — close + reopen + unlock + assert cleartext renders ──
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await resourceRow.click()
  await unlockVaultModalIfShown(page)
  const reopenedNotes = page.locator('textarea[placeholder*="notes about this resource" i]')
  await expect(reopenedNotes).toHaveValue(SECRET_NOTES, { timeout: 15_000 })
  console.log('[saved-res-enc] (b) PASS: decrypted notes render in UI after unlock')

  // ── (c) LOCKED HIDES PLAINTEXT — lock the vault, reopen, assert no leak ──
  await page.keyboard.press('Escape')
  // The DEK persists in IndexedDB ('feed-crypto-keys') across reloads, so a
  // plain reload would stay unlocked. Delete that store to force a genuinely
  // LOCKED vault — the exact threat-model state (ciphertext at rest, no key).
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('feed-crypto-keys')
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    })
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('[data-testid="sidebar-documents"]').click()
  await page.waitForTimeout(1_000)
  await page.locator('[data-testid="docs-tab-resources"]').click()
  await page.waitForTimeout(800)
  // re-expand + open the row WITHOUT unlocking
  if (!(await resourceRow.isVisible({ timeout: 2_000 }).catch(() => false))) {
    const headers = page.locator('button:has-text("food"), button:has-text("Food")')
    const count = await headers.count()
    for (let i = 0; i < count; i++) {
      await headers.nth(i).click().catch(() => {})
      if (await resourceRow.isVisible({ timeout: 1_500 }).catch(() => false)) break
    }
  }
  await expect(resourceRow).toBeVisible({ timeout: 10_000 })
  await resourceRow.click()
  // VaultGuard should show the unlock modal (vault locked) — do NOT unlock.
  await expect(page.locator('[data-testid="vault-unlock-password-input"]')).toBeVisible({ timeout: 10_000 })
  // The cleartext notes must NOT be present anywhere in the DOM while locked.
  await expect(page.locator(`text=${SECRET_NOTES}`)).toHaveCount(0)
  console.log('[saved-res-enc] (c) PASS: locked vault hides plaintext notes (no DOM leak)')
})
