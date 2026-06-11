/**
 * document-filename-encryption.spec.ts — Wave-4a Document Filename Encryption E2E
 *
 * Proves zero-knowledge-at-rest for the user_documents filename end-to-end
 * against the hosted Supabase project (closes leak #7):
 *
 *   (a) PLACEHOLDER AT REST — after the UI uploads an encrypted document, a
 *       Management-API SELECT confirms the plaintext `name` column equals the
 *       non-PII placeholder 'Encrypted Document' (NOT the real filename), and
 *       encrypted_original_name / encrypted_name_iv are populated and do NOT
 *       contain the cleartext filename.
 *   (b) DECRYPTED IN UI — the Documents list renders the original real filename
 *       after the vault is unlocked (decrypt round-trip succeeds).
 *   (c) LOCKED HIDES PLAINTEXT — after locking the vault and reloading, the list
 *       shows the placeholder and the real cleartext filename does NOT appear
 *       anywhere in the DOM.
 *
 * Run:
 *   npx playwright test apps/web/e2e/document-filename-encryption.spec.ts --reporter=line
 *
 * Cleanup:
 *   afterAll deletes the user_documents rows then the test user. Runs even on
 *   failure.
 */

import { test, expect, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  makeAdminClient,
  provisionVaultUser,
  deleteProvisionedUser,
  type VaultProvisionResult,
} from './helpers/vault-fixture'

const VAULT_PASSWORD = 'Test-Doc-Fname-123!'
const FIXED_TS = '20260611docfname'
const TEST_EMAIL = `e2e+docfname-${FIXED_TS}@feed.local`
// A distinctive, PII-shaped filename — easy to grep for in the DOM / DB / cipher.
const REAL_FILENAME = `SSN-Card-Jane-Doe-${FIXED_TS}.pdf`
const PLACEHOLDER = 'Encrypted Document'

const MGMT_SQL_URL =
  'https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query'

let admin: SupabaseClient
let provision: VaultProvisionResult

async function mgmtQuery(sql: string): Promise<Array<Record<string, unknown>>> {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) {
    throw new Error('SUPABASE_ACCESS_TOKEN missing — required for at-rest assertion.')
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

  // Clean up any leftover from a prior run with this fixed identifier.
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) {
    await admin.from('user_documents').delete().eq('user_id', prior.id)
    await deleteProvisionedUser(admin, prior.id)
  }

  provision = await provisionVaultUser({
    adminClient: admin,
    email: TEST_EMAIL,
    password: VAULT_PASSWORD,
    fullName: 'Doc Fname Tester',
    phone: '5557778888',
    residentialAddress: {
      line1: '9 Cipher Ct',
      city: 'Denver',
      state: 'CO',
      zip_code: '80014',
    },
  })
})

test.afterAll(async () => {
  try {
    if (provision?.userId) {
      await admin.from('user_documents').delete().eq('user_id', provision.userId)
      await deleteProvisionedUser(admin, provision.userId)
    }
  } catch (err) {
    console.error('[doc-fname-enc] afterAll cleanup error (non-fatal):', err)
  }
})

async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', provision.email)
  await page.fill('#password', provision.password)
  await page.click('button[type=submit]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })
}

async function gotoMyDocuments(page: Page): Promise<void> {
  await page.locator('[data-testid="sidebar-documents"]').click()
  const docsTab = page.locator('#docs-tab-documents')
    .or(page.locator('[role="tab"]').filter({ hasText: /My Documents/i }))
  await expect(docsTab).toBeVisible({ timeout: 10_000 })
  await docsTab.click()
}

async function unlockVaultViaCard(page: Page): Promise<void> {
  // The EncryptedUpload card shows "Vault Locked" — click it to open the modal.
  const lockedCard = page.getByTestId('vault-locked-card')
  await expect(lockedCard).toBeVisible({ timeout: 10_000 })
  await lockedCard.click({ position: { x: 20, y: 20 } })
  const passwordInput = page.locator('[data-testid="vault-unlock-password-input"]')
  await expect(passwordInput).toBeVisible({ timeout: 8_000 })
  await passwordInput.fill(VAULT_PASSWORD)
  const submit = page.locator('[data-testid="vault-unlock-submit-button"]')
  await expect(submit).toBeEnabled({ timeout: 5_000 })
  await submit.click()
  await expect(passwordInput).not.toBeVisible({ timeout: 15_000 })
}

test('document filename: upload→placeholder-at-rest→decrypt-in-UI→locked-hides', async ({ page }) => {
  // ── Login + open My Documents ──
  await loginAsTestUser(page)
  await gotoMyDocuments(page)

  // ── Unlock the vault (required before encrypted upload) ──
  await unlockVaultViaCard(page)

  // ── Upload a document via the UI with a known PII-shaped filename ──
  // The drop-zone file input accepts pdf/jpg/png/webp. Set a PDF buffer.
  const fileInput = page.locator('input[type="file"]')
  await expect(fileInput).toBeAttached({ timeout: 10_000 })
  await fileInput.setInputFiles({
    name: REAL_FILENAME,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
  })
  // Click "Encrypt and Upload".
  await page.locator('button:has-text("Encrypt and Upload")').click()
  // Success confirmation appears once the encrypted write commits.
  await expect(page.locator('text=Document uploaded successfully').first())
    .toBeVisible({ timeout: 30_000 })
  console.log('[doc-fname-enc] upload committed')

  // ── (a) PLACEHOLDER AT REST — Management-API SELECT ──
  await page.waitForTimeout(1_500) // allow the write to commit
  const rows = await mgmtQuery(
    `SELECT name, encrypted_original_name, encrypted_name_iv, is_encrypted ` +
    `FROM public.user_documents WHERE user_id = '${provision.userId}' ` +
    `ORDER BY created_at DESC LIMIT 1;`
  )
  expect(rows.length).toBe(1)
  const row = rows[0]
  // plaintext `name` is the non-PII placeholder, NOT the real filename
  expect(row.name).toBe(PLACEHOLDER)
  expect(row.name as string).not.toContain('SSN')
  expect(row.name as string).not.toBe(REAL_FILENAME)
  expect(row.is_encrypted).toBe(true)
  // ciphertext + iv populated
  expect(typeof row.encrypted_original_name).toBe('string')
  expect((row.encrypted_original_name as string).length).toBeGreaterThan(0)
  expect(typeof row.encrypted_name_iv).toBe('string')
  expect((row.encrypted_name_iv as string).length).toBeGreaterThan(0)
  // the real filename must NOT appear inside the stored ciphertext
  expect(row.encrypted_original_name as string).not.toContain(REAL_FILENAME)
  expect(row.encrypted_original_name as string).not.toContain('SSN')
  console.log('[doc-fname-enc] (a) PASS: name=placeholder at rest, ciphertext populated, no cleartext leak')

  // ── (b) DECRYPTED IN UI — the list renders the real filename (vault unlocked) ──
  // The upload's onUploadComplete refetches the list; the panel's resolver
  // decrypts encrypted_original_name for display while the vault is still
  // unlocked. Assert the real filename renders (no reload — a reload returns the
  // vault to the LOCKED state, which is exercised separately in (c)).
  const card = page.locator('[data-testid="document-card"]').first()
  await expect(card).toBeVisible({ timeout: 15_000 })
  await expect(card.locator(`text=${REAL_FILENAME}`)).toBeVisible({ timeout: 15_000 })
  // And the card itself does NOT show the placeholder while unlocked.
  // (Page-wide the string "Encrypted Document" also appears in the upload zone's
  //  "Upload Encrypted Document" copy, so the assertion is scoped to the card.)
  await expect(card.locator(`text=${PLACEHOLDER}`)).toHaveCount(0)
  console.log('[doc-fname-enc] (b) PASS: decrypted real filename renders while unlocked')

  // ── (c) LOCKED HIDES PLAINTEXT — delete the DEK store, reload, assert placeholder ──
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
  await gotoMyDocuments(page)
  const lockedCard = page.locator('[data-testid="document-card"]').first()
  await expect(lockedCard).toBeVisible({ timeout: 15_000 })
  // While locked the list shows the placeholder, NOT the real filename.
  await expect(lockedCard.locator(`text=${PLACEHOLDER}`)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(`text=${REAL_FILENAME}`)).toHaveCount(0)
  console.log('[doc-fname-enc] (c) PASS: locked vault shows placeholder, no plaintext filename in DOM')
})
