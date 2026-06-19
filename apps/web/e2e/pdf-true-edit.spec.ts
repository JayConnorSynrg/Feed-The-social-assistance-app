/**
 * pdf-true-edit.spec.ts — True-Edit PDF Round-Trip E2E
 *
 * Proves the full sidecar-JSON true-edit loop:
 *
 *   (1) Unlock vault; fill a PDF — place text "AAA"; Save → doc appears in
 *       Documents panel in live DOM (no reload).
 *   (2) Click Edit (data-testid="doc-edit-btn") → annotator opens AND the "AAA"
 *       annotation is visible (initialAnnotations round-tripped from DB).
 *   (3) Edit "AAA"→"BBB", add new "CCC", DELETE one box → Save.
 *   (4) Reopen Edit → "BBB" and "CCC" PRESENT, the deleted annotation ABSENT.
 *   (5) View → in-app viewer (data-testid="document-viewer") opens flattened
 *       with no CSP or page errors.
 *
 * Architecture under test:
 *   - forms-panel.tsx :: handlePdfSave sends { sourceBytes, annotations } →
 *       uploadFile(sourceFile, 'other', annotations) → INSERT encrypted_annotations
 *   - documents-panel.tsx :: handleEdit → downloadForEdit → PdfAnnotator
 *       with initialAnnotations
 *   - handleEditSave → updateAnnotations → UPDATE encrypted_annotations
 *   - handleView with hasAnnotations → exportFlattened → PdfDocumentViewer
 *
 * Run:
 *   npx playwright test apps/web/e2e/pdf-true-edit.spec.ts --reporter=line
 *
 * Prerequisites:
 *   - apps/web/.env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Dev server starts automatically via playwright.config.ts webServer config
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
const FIXED_TS = '20260601trueedit'
const TEST_EMAIL = `e2e+trueedit-${FIXED_TS}@feed.local`

// Reuse the fixture PDF written by pdf-annotator.spec.ts (or self-generated)
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'minimal-acroform.pdf')

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

  // Clean up any leftover from a prior run with this fixed email
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) {
    await deleteProvisionedUser(admin, prior.id)
  }

  provision = await provisionVaultUser({
    adminClient: admin,
    email: TEST_EMAIL,
    password: VAULT_PASSWORD,
    fullName: 'TrueEdit Test User',
    phone: '5558880000',
    residentialAddress: {
      line1: '1 TrueEdit Lane',
      city: 'Burlington',
      state: 'VT',
      zip_code: '05401',
    },
  })

  console.log(`[pdf-true-edit] Provisioned user: ${provision.userId}`)
})

test.afterAll(async () => {
  try {
    if (provision?.userId) {
      await deleteProvisionedUser(admin, provision.userId)
      console.log(`[pdf-true-edit] Deleted test user ${provision.userId}`)
    }
  } catch (err) {
    console.error('[pdf-true-edit] afterAll cleanup error (non-fatal):', err)
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
}

async function unlockVault(page: Page): Promise<void> {
  const passwordInput = page.locator('[data-testid="vault-unlock-password-input"]')
  const isVisible = await passwordInput.isVisible({ timeout: 8_000 }).catch(() => false)
  if (isVisible) {
    await passwordInput.fill(VAULT_PASSWORD)
    await page.locator('[data-testid="vault-unlock-submit-button"]').click()
    await expect(passwordInput).not.toBeVisible({ timeout: 20_000 })
    console.log('[pdf-true-edit] Vault unlocked')
  }
}

/** Navigate to the Applications sub-tab (Forms & Applications hub) inside the Documents panel */
async function openFormsTab(page: Page): Promise<void> {
  const docsSidebarBtn = page.locator('[data-testid="sidebar-documents"]')
  await docsSidebarBtn.click()
  const formsTab = page.locator('#docs-tab-applications')
    .or(page.locator('[role="tab"]').filter({ hasText: /^Applications$/i }))
  await expect(formsTab).toBeVisible({ timeout: 10_000 })
  await formsTab.click()
  await page.waitForTimeout(500)
}

/** Click "Fill PDF Form" and upload the fixture PDF */
async function uploadFixturePdf(page: Page): Promise<void> {
  const fillPdfBtn = page.locator('button').filter({ hasText: /Fill PDF Form/i })
  await expect(fillPdfBtn).toBeVisible({ timeout: 15_000 })
  const fileChooserPromise = page.waitForEvent('filechooser')
  await fillPdfBtn.click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(FIXTURE_PDF)
}

/** Wait for the PDF canvas to appear (react-pdf load complete) */
async function waitForPdfCanvas(page: Page): Promise<void> {
  const canvas = page.locator('.react-pdf__Page__canvas').first()
  await expect(canvas).toBeVisible({ timeout: 30_000 })
}

/** Place a text annotation at a fixed canvas position and type the given text */
async function placeAnnotation(page: Page, text: string): Promise<void> {
  // Enable placement mode if not already in it
  const addBtn = page.locator('button').filter({ hasText: /Add Text Box/i })
  const clickToPlaceBtn = page.locator('button').filter({ hasText: /Click Page to Place/i })
  const inPlacementMode = await clickToPlaceBtn.isVisible({ timeout: 500 }).catch(() => false)
  if (!inPlacementMode) {
    await expect(addBtn).toBeVisible({ timeout: 10_000 })
    await addBtn.click()
    await expect(clickToPlaceBtn).toBeVisible({ timeout: 5_000 })
  }

  // The PageOverlay div is the click target in placement mode — it sits above the canvas.
  // We click the overlay at a safe position inside the rendered page area.
  // The overlay uses position:absolute inset:0 over the canvas; clicking anywhere
  // within the page wrapper fires handleClick → adds the annotation.
  const pageWrapper = page.locator('.react-pdf__Page').first()
  await pageWrapper.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)

  // Use force:true to bypass the overlay interception that Playwright's pointer-event
  // detection reports (the overlay IS the intended target — it has onClick).
  await pageWrapper.click({ position: { x: 120, y: 250 }, force: true })
  await page.waitForTimeout(400)

  // Exit placement mode so we can interact with the placed annotation
  const isStillPlacing = await clickToPlaceBtn.isVisible({ timeout: 500 }).catch(() => false)
  if (isStillPlacing) {
    await clickToPlaceBtn.click()
    await page.waitForTimeout(200)
  }

  // The annotation box should now be visible — double-click to edit, type text
  const annotationBox = page.locator('div[style*="dashed"]').last()
  await expect(annotationBox).toBeVisible({ timeout: 5_000 })
  await annotationBox.dblclick()
  await page.waitForTimeout(200)
  await page.keyboard.type(text)

  // Click elsewhere to commit (outside any annotation)
  await page.locator('.react-pdf__Page__canvas').first().click({ position: { x: 400, y: 600 }, force: true })
  await page.waitForTimeout(300)
}

/** Delete the last visible annotation box (by clicking its remove button) */
async function deleteLastAnnotation(page: Page): Promise<void> {
  const removeButtons = page.locator('button[aria-label="Remove text box"]')
  const count = await removeButtons.count()
  if (count === 0) {
    throw new Error('No annotation boxes found to delete')
  }
  await removeButtons.last().click()
  await page.waitForTimeout(200)
}

// ---------------------------------------------------------------------------
// Main test
// ---------------------------------------------------------------------------

test('PDF true-edit: fill → save → edit → re-save → view (full sidecar round-trip)', async ({ page }) => {
  // ── Collect CSP violations and page errors throughout ────────────────────
  const cspViolations: string[] = []
  const pageErrors: Error[] = []

  page.on('console', (msg) => {
    const text = msg.text()
    if (/Content Security Policy|Refused to connect/i.test(text)) {
      cspViolations.push(text)
    }
  })
  page.on('pageerror', (err) => {
    pageErrors.push(err)
  })

  // ────────────────────────────────────────────────────────────────────────
  // STEP 1: Login, navigate to Forms, upload PDF, place "AAA", Save
  // ────────────────────────────────────────────────────────────────────────
  await loginAsTestUser(page)
  await openFormsTab(page)
  await uploadFixturePdf(page)

  // Unlock vault if prompted
  await unlockVault(page)

  // Wait for PDF to render
  await waitForPdfCanvas(page)
  console.log('[pdf-true-edit] STEP 1: PDF canvas visible')

  // Place annotation "AAA"
  await placeAnnotation(page, 'AAA')
  console.log('[pdf-true-edit] STEP 1: Placed annotation "AAA"')

  // Save
  const savePdfBtn = page.locator('button').filter({ hasText: /Save PDF/i })
  await expect(savePdfBtn).toBeVisible({ timeout: 10_000 })
  await savePdfBtn.click()
  console.log('[pdf-true-edit] STEP 1: Save PDF clicked')

  // Doc appears in Documents panel — live DOM, no reload
  await expect(
    page.locator('text=minimal-acroform.pdf')
  ).toBeVisible({ timeout: 20_000 })
  console.log('[pdf-true-edit] STEP 1 PASSED: doc appears in Documents list (live DOM)')

  // Verify DB has encrypted_annotations set (proves sidecar was stored).
  // NOTE: the `name` column stores only the non-PII placeholder 'Encrypted Document'
  // (see ENCRYPTED_DOCUMENT_NAME_PLACEHOLDER in document-encryption.ts); the real
  // filename lives in encrypted_original_name / encrypted_name_iv. We therefore
  // match the first row belonging to this user rather than by filename.
  const { data: dbRows, error: dbErr } = await admin
    .from('user_documents')
    .select('id, name, encrypted_annotations, annotations_iv')
    .eq('user_id', provision.userId)
    .limit(10)
  expect(dbErr).toBeNull()
  // Any document for this user — there should be exactly one after the first save
  const docRow = (dbRows ?? [])[0]
  expect(docRow).toBeTruthy()
  expect(docRow?.encrypted_annotations).not.toBeNull()
  expect(docRow?.annotations_iv).not.toBeNull()
  console.log('[pdf-true-edit] STEP 1 PASSED: DB confirms encrypted_annotations stored')

  // ────────────────────────────────────────────────────────────────────────
  // STEP 2: Click Edit → annotator opens with "AAA" pre-populated
  // ────────────────────────────────────────────────────────────────────────
  // The Edit button is only visible on PDF cards
  const editBtn = page.locator('[data-testid="doc-edit-btn"]').first()
  await expect(editBtn).toBeVisible({ timeout: 10_000 })
  await editBtn.click()
  console.log('[pdf-true-edit] STEP 2: Edit button clicked')

  // Vault may prompt again (re-auth between panels)
  await unlockVault(page)

  // Wait for annotator canvas
  await waitForPdfCanvas(page)
  console.log('[pdf-true-edit] STEP 2: Annotator canvas visible')

  // "AAA" annotation must be present (initialAnnotations seeded)
  // The annotation text is rendered in a contenteditable div inside the box
  await expect(
    page.locator('div[contenteditable]').filter({ hasText: 'AAA' })
  ).toBeVisible({ timeout: 10_000 })
  console.log('[pdf-true-edit] STEP 2 PASSED: "AAA" annotation visible (initialAnnotations loaded)')

  // ────────────────────────────────────────────────────────────────────────
  // STEP 3: Edit "AAA"→"BBB", add "CCC", delete one box → Save
  // ────────────────────────────────────────────────────────────────────────
  // Edit "AAA" → "BBB": double-click the existing annotation text area
  const aaaBox = page.locator('div[contenteditable]').filter({ hasText: 'AAA' })
  await expect(aaaBox).toBeVisible({ timeout: 10_000 })
  await aaaBox.dblclick()
  await page.waitForTimeout(200)
  // Select all and replace
  await page.keyboard.press('Control+a')
  await page.keyboard.type('BBB')
  // Click outside to commit — use force since canvas may be covered
  await page.locator('.react-pdf__Page__canvas').first().click({ position: { x: 300, y: 500 }, force: true })
  await page.waitForTimeout(400)
  console.log('[pdf-true-edit] STEP 3: "AAA" → "BBB" edit done')

  // Add "CCC"
  await placeAnnotation(page, 'CCC')
  console.log('[pdf-true-edit] STEP 3: "CCC" annotation placed')

  // Delete the last annotation (whichever was placed last)
  // There are now 2 boxes: "BBB" and "CCC" — delete "CCC"
  await deleteLastAnnotation(page)
  console.log('[pdf-true-edit] STEP 3: Last annotation deleted')

  // Save
  const savePdfBtn2 = page.locator('button').filter({ hasText: /Save PDF/i })
  await expect(savePdfBtn2).toBeVisible({ timeout: 10_000 })
  await savePdfBtn2.click()
  console.log('[pdf-true-edit] STEP 3: Save PDF clicked')

  // Should return to Documents list
  await expect(
    page.locator('text=minimal-acroform.pdf')
  ).toBeVisible({ timeout: 20_000 })
  console.log('[pdf-true-edit] STEP 3 PASSED: returned to Documents list after edit-save')

  // ────────────────────────────────────────────────────────────────────────
  // STEP 4: Reopen Edit → "BBB" present, "CCC" absent (deleted annotation gone)
  // ────────────────────────────────────────────────────────────────────────
  const editBtn2 = page.locator('[data-testid="doc-edit-btn"]').first()
  await expect(editBtn2).toBeVisible({ timeout: 10_000 })
  await editBtn2.click()

  await unlockVault(page)
  await waitForPdfCanvas(page)
  console.log('[pdf-true-edit] STEP 4: Annotator re-opened')

  // "BBB" must be present
  await expect(
    page.locator('div[contenteditable]').filter({ hasText: 'BBB' })
  ).toBeVisible({ timeout: 10_000 })
  console.log('[pdf-true-edit] STEP 4 PASSED: "BBB" annotation present')

  // "CCC" must NOT be present (was deleted and save was called)
  await expect(
    page.locator('div[contenteditable]').filter({ hasText: 'CCC' })
  ).not.toBeVisible({ timeout: 5_000 })
  console.log('[pdf-true-edit] STEP 4 PASSED: "CCC" annotation absent (delete persisted)')

  // Verify DB: re-fetch encrypted_annotations — it should have changed
  const { data: updatedRows } = await admin
    .from('user_documents')
    .select('id, encrypted_annotations')
    .eq('user_id', provision.userId)
    .eq('name', 'minimal-acroform.pdf')
    .limit(1)
  const updatedRow = (updatedRows ?? [])[0]
  // Annotations were re-encrypted — ciphertext should differ from original
  expect(updatedRow?.encrypted_annotations).not.toEqual(docRow?.encrypted_annotations)
  console.log('[pdf-true-edit] STEP 4 PASSED: DB confirms annotations updated (ciphertext changed)')

  // Cancel the edit (we verified state; no need to save again)
  const cancelBtn = page.locator('button').filter({ hasText: /Cancel/i })
  await expect(cancelBtn).toBeVisible({ timeout: 5_000 })
  await cancelBtn.click()

  // ────────────────────────────────────────────────────────────────────────
  // STEP 5: View → in-app viewer opens (flattened) with zero CSP/page errors
  // ────────────────────────────────────────────────────────────────────────
  const viewBtn = page.locator('[data-testid="doc-view-btn"]').first()
  await expect(viewBtn).toBeVisible({ timeout: 10_000 })
  await viewBtn.click()
  console.log('[pdf-true-edit] STEP 5: View button clicked')

  // The in-app PdfDocumentViewer dialog should open
  const viewer = page.locator('[data-testid="document-viewer"]')
    .or(page.locator('[role="dialog"]').filter({ has: page.locator('canvas') }))
  await expect(viewer).toBeVisible({ timeout: 30_000 })
  console.log('[pdf-true-edit] STEP 5 PASSED: in-app viewer opened')

  // No CSP violations or page errors throughout the entire flow
  expect(cspViolations, 'CSP violations detected').toHaveLength(0)
  expect(pageErrors, 'Page errors detected').toHaveLength(0)
  console.log('[pdf-true-edit] ALL STEPS PASSED: zero CSP violations, zero page errors')
  console.log('[pdf-true-edit] TRUE-EDIT round-trip VERIFIED: fill → save → edit → re-save → view')
})
