/**
 * pdf-annotator.spec.ts — PDF Annotator E2E
 *
 * Verifies the CSP fix and PDF annotator flow end-to-end:
 *   P1  Select a PDF file → annotator renders (react-pdf canvas appears,
 *       "Failed to load PDF" text is NOT present).
 *   P2  Zero CSP violations: no "Content Security Policy" or "Refused to connect"
 *       messages in browser console and no page errors during the entire flow.
 *   P3  Save navigates to the Documents panel (encrypted upload via
 *       useEncryptedUpload — vault must be unlocked via VaultGuard).
 *   P4  The saved document appears in the Documents panel listing.
 *
 * Root cause guarded: PdfAnnotator previously called fetch(blob:URL) which
 * CSP connect-src blocked (no blob: allowed). Fix: file.arrayBuffer() — zero
 * fetch, zero blob URL. This spec asserts the fix is live at runtime.
 *
 * Run:
 *   npx playwright test apps/web/e2e/pdf-annotator.spec.ts --reporter=line
 *
 * Prerequisites:
 *   - apps/web/.env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Dev server starts automatically via playwright.config.ts webServer config
 */

import { test, expect, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'
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
const FIXED_TS = '20260601pdfann'
const TEST_EMAIL = `e2e+pdfann-${FIXED_TS}@feed.local`

// ---------------------------------------------------------------------------
// Fixture PDF: generate a minimal valid PDF for upload
// We generate it in a temp file once per run using @cantoo/pdf-lib in Node.
// ---------------------------------------------------------------------------

let fixturePdfPath: string

async function generateFixturePdf(): Promise<string> {
  // Dynamic import: @cantoo/pdf-lib is ESM-compatible in Node
  const { PDFDocument, rgb } = await import('@cantoo/pdf-lib')
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])

  const form = doc.getForm()
  const field = form.createTextField('name')
  field.setText('Test Name')
  field.addToPage(page, { x: 50, y: 700, width: 200, height: 24 })

  page.drawText('E2E Fixture PDF — FEED PDF Annotator Test', {
    x: 50,
    y: 650,
    size: 12,
    color: rgb(0, 0, 0),
  })

  const bytes = await doc.save()
  const tmpDir = path.resolve(process.cwd(), 'apps/web/e2e/fixtures')
  fs.mkdirSync(tmpDir, { recursive: true })
  const outPath = path.join(tmpDir, 'minimal-acroform.pdf')
  fs.writeFileSync(outPath, Buffer.from(bytes))
  return outPath
}

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
    fullName: 'PDF Test User',
    phone: '5559990000',
    residentialAddress: {
      line1: '1 PDF Lane',
      city: 'San Francisco',
      state: 'CA',
      zip_code: '94102',
    },
  })

  // Generate the fixture PDF once before all tests
  fixturePdfPath = await generateFixturePdf()
  console.log(`[pdf-annotator] Fixture PDF written to: ${fixturePdfPath}`)
})

test.afterAll(async () => {
  try {
    if (provision?.userId) {
      await deleteProvisionedUser(admin, provision.userId)
      console.log(`[pdf-annotator] Deleted test user ${provision.userId}`)
    }
  } catch (err) {
    console.error('[pdf-annotator] afterAll cleanup error (non-fatal):', err)
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
    console.log('[pdf-annotator] Vault unlocked')
  }
}

// ---------------------------------------------------------------------------
// Main Test
// ---------------------------------------------------------------------------

test('P1+P2+P3+P4: PDF renders, zero CSP violations, save navigates to Documents', async ({ page }) => {
  // ── Collect console messages and page errors ──────────────────────────────
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

  // ── Login ─────────────────────────────────────────────────────────────────
  await loginAsTestUser(page)

  // ── Navigate to the Applications sub-tab (Forms & Applications hub) ────────
  // "Forms" alias now maps to Documents panel with subtab=applications.
  // The sidebar button has data-testid="sidebar-documents" (label: "Documents & Forms").
  // After the sidebar click we must also click the "Applications" sub-tab inside the panel.
  const docsSidebarBtn = page.locator('[data-testid="sidebar-documents"]')
  await docsSidebarBtn.click()
  // Click the "Applications" sub-tab (id="docs-tab-applications") to activate FormsPanel
  const formsTab = page.locator('#docs-tab-applications')
    .or(page.locator('[role="tab"]').filter({ hasText: /^Applications$/i }))
  await expect(formsTab).toBeVisible({ timeout: 10_000 })
  await formsTab.click()
  await page.waitForTimeout(1_000)

  // ── Click "Fill PDF Form" button ──────────────────────────────────────────
  const fillPdfBtn = page.locator('button').filter({ hasText: /Fill PDF Form/i })
  await expect(fillPdfBtn).toBeVisible({ timeout: 15_000 })

  // Set up file chooser before clicking
  const fileChooserPromise = page.waitForEvent('filechooser')
  await fillPdfBtn.click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(fixturePdfPath)
  console.log(`[pdf-annotator] File selected: ${fixturePdfPath}`)

  // ── P1: PDF renders ───────────────────────────────────────────────────────
  // VaultGuard wraps the PDF annotator — unlock if needed
  await unlockVault(page)

  // react-pdf renders a canvas per page when loading succeeds
  const pdfCanvas = page.locator('canvas').first()
  await expect(pdfCanvas).toBeVisible({ timeout: 30_000 })
  console.log('[pdf-annotator] P1 PASSED: PDF canvas is visible (react-pdf rendered successfully)')

  // "Failed to load PDF" must NOT appear
  const failedText = page.locator('text=Failed to load PDF')
  await expect(failedText).not.toBeVisible({ timeout: 5_000 })
  console.log('[pdf-annotator] P1 PASSED: "Failed to load PDF" is not visible')

  // ── P2: Zero CSP violations so far ───────────────────────────────────────
  expect(cspViolations).toHaveLength(0)
  console.log('[pdf-annotator] P2 PASSED (pre-save): zero CSP violations')
  expect(pageErrors).toHaveLength(0)
  console.log('[pdf-annotator] P2 PASSED (pre-save): zero page errors')

  // ── P3: Save navigates to Documents panel ────────────────────────────────
  const savePdfBtn = page.locator('button').filter({ hasText: /Save PDF/i })
  await expect(savePdfBtn).toBeVisible({ timeout: 10_000 })
  await savePdfBtn.click()
  console.log('[pdf-annotator] Save PDF clicked — waiting for navigation to Documents panel')

  // After save, handlePdfSave calls setWizardState({mode:'list'}) and
  // setActivePanel('documents'), which hides the PDF annotator and shows the
  // My Documents list view. Assert the "Save PDF" button is gone (annotator unmounted)
  // AND the Documents list view is active. This is tighter than just checking for a
  // heading because the parent Documents panel shows a heading even when the annotator
  // is still mounted (forms is a subtab of documents — PANEL_ALIASES.forms).
  await expect(savePdfBtn).not.toBeVisible({ timeout: 30_000 })
  // Also assert the My Documents tab is selected (confirms subtab navigated to 'documents')
  await expect(page.locator('[data-testid="docs-tab-documents"]')).toBeVisible({ timeout: 10_000 })
  console.log('[pdf-annotator] P3 PASSED: Save PDF button gone (annotator unmounted), Documents view active')

  // ── P4: DB confirms document was saved ───────────────────────────────────
  // Authoritative persistence check — the encrypted upload must have written to user_documents.
  const { data: docs, error: dbErr } = await admin
    .from('user_documents')
    .select('id, name')
    .eq('user_id', provision.userId)
    .limit(5)
  expect(dbErr).toBeNull()
  expect(docs).not.toBeNull()
  expect((docs ?? []).length).toBeGreaterThan(0)
  console.log(`[pdf-annotator] P4 PASSED (DB): ${(docs ?? []).length} document(s) saved — ${(docs ?? []).map((d: { name: string }) => d.name).join(', ')}`)

  // ── P5: Saved document appears in the live DOM (no reload, no remount) ────
  // This is the real user-visible flow: DocumentsPanel is ALREADY mounted
  // (forms is a subtab of documents — PANEL_ALIASES.forms → {panel:'documents', subtab:'forms'}).
  // After "Save PDF", handlePdfSave calls setActivePanel('documents') +
  // setPanelParams({subtab:'documents'}). The panel does NOT remount, so its
  // documents fetch effect must re-fire on the subtab/viewMode change — otherwise
  // the just-saved document never appears in the DOM.
  //
  // CRITICAL: no page.reload(), no extra navigation, no admin DB bypass.
  // Assert the filename appears in rendered HTML within a reasonable wait.
  // If the fetch effect is keyed only on [user?.id] (the bug), this fails
  // because the effect doesn't re-run when the user returns to documents view.
  await expect(
    page.locator('text=minimal-acroform.pdf')
  ).toBeVisible({ timeout: 15_000 })
  console.log('[pdf-annotator] P5 PASSED: saved document visible in live DOM (no reload) — fetch effect re-fired on subtab switch')

  // ── P2 Final: Zero CSP violations after save ──────────────────────────────
  expect(cspViolations).toHaveLength(0)
  console.log('[pdf-annotator] P2 PASSED (post-save): zero CSP violations throughout entire flow')
  expect(pageErrors).toHaveLength(0)
  console.log('[pdf-annotator] P2 PASSED (post-save): zero page errors throughout entire flow')

  console.log('[pdf-annotator] ALL ASSERTIONS PASSED: P1 + P2 + P3 + P4 + P5')
})
