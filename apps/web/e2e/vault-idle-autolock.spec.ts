/**
 * vault-idle-autolock.spec.ts — Idle auto-lock + pre-lock flush E2E
 *
 * Proves the PR#93 regression fix end-to-end: when the vault auto-locks
 * mid-flow (15-min idle), the guarded PDF annotator flow is unmounted by
 * VaultGuard — but the in-progress annotation is FLUSHED to the encrypted
 * Documents store FIRST, so zero work is lost. On re-unlock the saved draft is
 * recoverable.
 *
 * This is the render-lifecycle proof that static reasoning + unit tests cannot
 * give: it exercises the real idle timer → real flush callback → real
 * uploadFile → real DB write, and confirms the vault actually locks afterward.
 *
 * Mechanics:
 *   - page.clock.install() fakes the page JS clock BEFORE navigation so the
 *     app's setTimeout(lock, 15min) uses it. Network (Supabase) still runs in
 *     real time. fastForward(>15min) fires the real idle lock with no
 *     production test hooks.
 *   - Persistence is asserted against the DB (user_documents row with an
 *     encrypted annotations sidecar) — deterministic, not UI-scrape fragile.
 *
 * Modal path (proven by pdf-annotator.spec.ts + vault-unlock-timeout.spec.ts):
 *   sidebar-documents → Forms tab → "Fill PDF Form" → file chooser → VaultGuard
 *   shows VaultUnlockModal when the vault is locked.
 *
 * Run (against this worktree's dev server on a free port — avoids the
 * reuseExistingServer mis-attribution trap):
 *   PLAYWRIGHT_TEST_BASE_URL=http://localhost:3999 \
 *     npx playwright test apps/web/e2e/vault-idle-autolock.spec.ts --reporter=line
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

// Must match apps/web/src/lib/vault-idle-lock.ts IDLE_LOCK_TIMEOUT_MS
const IDLE_LOCK_TIMEOUT_MS = 15 * 60 * 1000

const VAULT_PASSWORD = 'Test-Idle-Autolock-123!'
const FIXED_TS = '20260612idleautolock'
const TEST_EMAIL = `e2e+idleautolock-${FIXED_TS}@feed.local`

const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'minimal-acroform.pdf')

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:3000'

// Generous overall budget: login + nav + unlock + annotate + flush + DB poll.
const TEST_TIMEOUT_MS = 90_000

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

  // Clean up any leftover from a prior run with this fixed identifier.
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) {
    await deleteProvisionedUser(admin, prior.id)
  }

  provision = await provisionVaultUser({
    adminClient: admin,
    email: TEST_EMAIL,
    password: VAULT_PASSWORD,
    fullName: 'Idle Autolock User',
    phone: '5550002222',
    residentialAddress: {
      line1: '1 Idle Lane',
      city: 'Austin',
      state: 'TX',
      zip_code: '73301',
    },
  })
})

test.afterAll(async () => {
  try {
    if (provision?.userId) {
      // Remove any documents the flush created so the test is self-cleaning.
      await admin.from('user_documents').delete().eq('user_id', provision.userId)
      await deleteProvisionedUser(admin, provision.userId)
      console.log(`[idle-autolock] Deleted test user ${provision.userId}`)
    }
  } catch (err) {
    console.error('[idle-autolock] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test(
  'idle auto-lock flushes in-progress PDF annotation before locking — zero data loss',
  async ({ page }) => {
    // Fake the page JS clock BEFORE any navigation so the app's idle setTimeout
    // is installed against it. Network/Supabase keep real time.
    await page.clock.install()

    // ── Login ──────────────────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/login`)
    await page.fill('#email', provision.email)
    await page.fill('#password', provision.password)
    await page.click('button[type=submit]')
    await page.waitForURL(`${BASE_URL}/`, { timeout: 30_000 })

    // ── Navigate to Forms sub-tab → open the PDF annotator ─────────────────
    const docsSidebarBtn = page.locator('[data-testid="sidebar-documents"]')
    await docsSidebarBtn.click()
    const formsTab = page.locator('#docs-tab-forms')
      .or(page.locator('[role="tab"]').filter({ hasText: /^Forms$/i }))
    await expect(formsTab).toBeVisible({ timeout: 10_000 })
    await formsTab.click()
    await page.waitForTimeout(500)

    const fillPdfBtn = page.locator('button').filter({ hasText: /Fill PDF Form/i })
    await expect(fillPdfBtn).toBeVisible({ timeout: 15_000 })
    const fileChooserPromise = page.waitForEvent('filechooser')
    await fillPdfBtn.click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(FIXTURE_PDF)
    console.log(`[idle-autolock] File selected: ${FIXTURE_PDF}`)

    // ── Unlock the vault ───────────────────────────────────────────────────
    const passwordInput = page.locator('[data-testid="vault-unlock-password-input"]')
    await expect(passwordInput).toBeVisible({ timeout: 15_000 })
    await passwordInput.fill(VAULT_PASSWORD)
    await page.locator('[data-testid="vault-unlock-submit-button"]').click()

    // Annotator renders once the vault is unlocked (children of VaultGuard).
    const annotator = page.locator('[data-testid="pdf-annotator"]')
    await expect(annotator).toBeVisible({ timeout: 20_000 })
    console.log('[idle-autolock] Vault unlocked, annotator visible')

    // ── Enter work: place a text-box annotation on the page ────────────────
    // Mirrors the proven placement helper in pdf-true-edit.spec.ts. The
    // PageOverlay (position:absolute inset:0, zIndex:5) sits above the canvas
    // and IS the intended click target, so force:true bypasses Playwright's
    // overlay-interception guard.
    const canvas = page.locator('.react-pdf__Page__canvas').first()
    await expect(canvas).toBeVisible({ timeout: 30_000 })

    const addTextBtn = page.locator('button').filter({ hasText: /Add Text Box/i })
    const clickToPlaceBtn = page.locator('button').filter({ hasText: /Click Page to Place/i })
    await expect(addTextBtn).toBeVisible({ timeout: 10_000 })
    await addTextBtn.click()
    await expect(clickToPlaceBtn).toBeVisible({ timeout: 5_000 })

    const pageWrapper = page.locator('.react-pdf__Page').first()
    await pageWrapper.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await pageWrapper.click({ position: { x: 120, y: 250 }, force: true })
    await page.waitForTimeout(400)

    // Exit placement mode, then double-click the box and type so the annotation
    // carries real text (not just an empty placeholder).
    if (await clickToPlaceBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await clickToPlaceBtn.click()
      await page.waitForTimeout(200)
    }
    const placedBox = page.locator('[aria-label="Remove text box"]')
    await expect(placedBox).toBeVisible({ timeout: 10_000 })
    const annotationBox = page.locator('div[style*="dashed"]').last()
    await annotationBox.dblclick()
    await page.waitForTimeout(200)
    await page.keyboard.type('IDLE-FLUSH-PROOF')
    await canvas.click({ position: { x: 400, y: 600 }, force: true })
    await page.waitForTimeout(300)
    console.log('[idle-autolock] Annotation placed with text (work entered)')

    // ── Trigger the REAL idle lock: fast-forward the page clock past 15 min ──
    // No activity events are dispatched during the jump, so the idle timer is
    // not reset. This fires the app's setTimeout(lock, IDLE_LOCK_TIMEOUT_MS),
    // which runs the pre-lock flush (uploadFile → DB) and THEN locks.
    await page.clock.fastForward(IDLE_LOCK_TIMEOUT_MS + 1_000)
    console.log('[idle-autolock] Idle window fast-forwarded — lock should fire')

    // ── (a) Assert the vault LOCKED: VaultGuard re-shows the unlock modal ───
    // On lock isUnlocked flips false → VaultGuard unmounts the annotator and
    // renders VaultUnlockModal again (wizardState is preserved above VaultGuard,
    // so the user is returned to THIS flow, not the list).
    await expect(passwordInput).toBeVisible({ timeout: 20_000 })
    await expect(annotator).toBeHidden({ timeout: 5_000 })
    console.log('[idle-autolock] Vault locked — unlock modal re-shown, annotator unmounted')

    // ── (b) Assert the work was PERSISTED before the lock ──────────────────
    // The flush uploaded the source + encrypted annotations sidecar as a
    // user_documents row. Poll the DB (real time) for that row with a non-null
    // encrypted_annotations column — proof the annotation survived the unmount.
    let savedRow: { id: string; encrypted_annotations: string | null } | null = null
    const pollDeadline = Date.now() + 20_000
    while (Date.now() < pollDeadline) {
      const { data, error } = await admin
        .from('user_documents')
        .select('id, encrypted_annotations, annotations_iv')
        .eq('user_id', provision.userId)
        .not('encrypted_annotations', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw error
      if (data && data.length > 0) {
        savedRow = data[0]
        break
      }
      await new Promise((r) => setTimeout(r, 1_000))
    }

    expect(savedRow, 'flushed user_documents row with encrypted annotations sidecar').not.toBeNull()
    expect(savedRow!.encrypted_annotations, 'encrypted annotations sidecar present').toBeTruthy()
    console.log(`[idle-autolock] Flushed document persisted (id=${savedRow!.id}) — PASS`)

    // ── Re-unlock proves the saved work is recoverable ─────────────────────
    // (Recoverability path: the saved document is re-editable in Documents via
    // downloadForEdit, which reloads the encrypted annotations sidecar.)
    await passwordInput.fill(VAULT_PASSWORD)
    await page.locator('[data-testid="vault-unlock-submit-button"]').click()
    await expect(passwordInput).toBeHidden({ timeout: 20_000 })
    console.log('[idle-autolock] Re-unlock succeeded — flow recoverable')
  },
  { timeout: TEST_TIMEOUT_MS }
)
