/**
 * nav-nested-tabs-a11y.spec.ts — Nested tablist ARIA structural contract
 *
 * @axe-core/playwright is NOT installed in this project. This spec asserts the
 * ARIA structural contract directly via DOM queries instead.
 *
 * Assertions (per panel):
 *  1. Each outer tablist has a non-empty aria-label (unique per tablist).
 *  2. Every role="tab" inside the outer tablist has aria-controls pointing to
 *     an existing element id in the document.
 *  3. Every role="tabpanel" inside the outer tablist has aria-labelledby
 *     pointing to an existing tab id in the document.
 *  4. The inner (PetitionsPanel) tablist has a distinct aria-label from the
 *     outer Community&Messages tablist it lives inside.
 *
 * Panels under test:
 *  A. Documents → Applications subtab  (outer: docs tablist; no inner tablist)
 *  B. Community&Messages → Petitions subtab  (outer: feed tablist; inner:
 *     PetitionsPanel's All/Signed tablist)
 *
 * Auth pattern: same as sibling specs — /login → fill credentials → wait for shell.
 *
 * Run:
 *   cd apps/web && npx playwright test e2e/nav-nested-tabs-a11y.spec.ts --reporter=line
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Env / admin client
// ---------------------------------------------------------------------------

function makeAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXED_TS = '20260618a11y'
const TEST_EMAIL = `e2e+nav-a11y-${FIXED_TS}@feed.local`
const TEST_PASSWORD = 'NavA11y-Test-2026!'

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let userId: string

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdmin()

  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) await admin.auth.admin.deleteUser(prior.id)

  const { data: created, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (error || !created?.user) throw new Error(`beforeAll createUser failed: ${error?.message}`)
  userId = created.user.id

  await admin
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', userId)
})

test.afterAll(async () => {
  try {
    if (userId) await admin.auth.admin.deleteUser(userId)
  } catch {
    /* non-fatal */
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAndGoToRoot(page: Page): Promise<void> {
  await page.goto('/login')
  if (!page.url().includes('/login')) {
    await page.goto('/')
    await page.waitForSelector('[data-testid="sidebar-chat"]', { timeout: 20_000 })
    return
  }
  await page.fill('#email', TEST_EMAIL)
  await page.fill('#password', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/$|\/\?/, { timeout: 30_000 })
  await page.waitForSelector('[data-testid="sidebar-chat"]', { timeout: 15_000 })
}

/**
 * Assert every role="tab" in `tablistSelector` has aria-controls pointing to
 * an element that actually exists in the document, and every role="tabpanel"
 * that is aria-labelledby'd by one of those tabs also exists.
 */
async function assertTablistAriaAssociations(
  page: Page,
  tablistSelector: string,
): Promise<void> {
  // Collect all tab elements inside this tablist
  const tabs = await page.locator(`${tablistSelector} [role="tab"]`).all()
  expect(tabs.length, `${tablistSelector} must contain at least one tab`).toBeGreaterThan(0)

  for (const tab of tabs) {
    const ariaControls = await tab.getAttribute('aria-controls')
    expect(
      ariaControls,
      `tab inside ${tablistSelector} must have aria-controls`,
    ).toBeTruthy()

    if (ariaControls) {
      // The controlled panel must exist
      const panel = page.locator(`#${CSS.escape(ariaControls)}`)
      const panelCount = await panel.count()
      expect(
        panelCount,
        `aria-controls="${ariaControls}" must point to an existing element`,
      ).toBeGreaterThan(0)

      // That panel must have aria-labelledby pointing back to a tab id
      const labelledBy = await panel.first().getAttribute('aria-labelledby')
      expect(
        labelledBy,
        `tabpanel #${ariaControls} must have aria-labelledby`,
      ).toBeTruthy()

      if (labelledBy) {
        const labelTab = page.locator(`#${CSS.escape(labelledBy)}`)
        const labelTabCount = await labelTab.count()
        expect(
          labelTabCount,
          `aria-labelledby="${labelledBy}" on panel #${ariaControls} must point to an existing tab`,
        ).toBeGreaterThan(0)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Test A: Documents → Applications subtab
// ---------------------------------------------------------------------------

test('A: Documents tablist — distinct aria-label + valid tab↔panel associations', async ({ page }) => {
  await loginAndGoToRoot(page)

  // Navigate to Documents → Applications subtab
  await page.locator('[data-testid="sidebar-documents"]').click()
  await page.locator('#docs-tab-applications').click()
  await page.locator('#docs-panel-applications').waitFor({ state: 'visible', timeout: 15_000 })

  // The outer docs tablist must have a non-empty aria-label
  const docsTablist = page.locator('[role="tablist"]').filter({ has: page.locator('#docs-tab-applications') })
  const docsLabel = await docsTablist.getAttribute('aria-label')
  expect(docsLabel, 'docs tablist must have a non-empty aria-label').toBeTruthy()

  // All tabs in the docs tablist must have valid aria-controls → panel associations
  await assertTablistAriaAssociations(page, '[role="tablist"]:has(#docs-tab-applications)')
})

// ---------------------------------------------------------------------------
// Test B: Community&Messages → Petitions subtab — 3-level disclosure depth
// ---------------------------------------------------------------------------

test('B: Feed tablist + inner Petitions tablist — distinct aria-labels + valid ARIA associations', async ({ page }) => {
  await loginAndGoToRoot(page)

  // Navigate to Community&Messages → Petitions subtab
  await page.locator('[data-testid="sidebar-feed"]').click()
  await page.locator('#feed-tab-petitions').click()
  await page.locator('#feed-panel-petitions').waitFor({ state: 'visible', timeout: 15_000 })

  // ── Outer feed tablist ─────────────────────────────────────────────────────
  const feedTablist = page.locator('[role="tablist"]').filter({ has: page.locator('#feed-tab-petitions') })
  const feedLabel = await feedTablist.getAttribute('aria-label')
  expect(feedLabel, 'feed tablist must have a non-empty aria-label').toBeTruthy()

  await assertTablistAriaAssociations(page, '[role="tablist"]:has(#feed-tab-petitions)')

  // ── Inner Petitions tablist (All / Signed) ─────────────────────────────────
  // PetitionsPanel renders its own tablist inside #feed-panel-petitions
  const innerTablist = page.locator('#feed-panel-petitions [role="tablist"]').first()
  await expect(innerTablist, 'inner Petitions tablist must exist').toBeVisible({ timeout: 10_000 })

  const innerLabel = await innerTablist.getAttribute('aria-label')
  expect(innerLabel, 'inner Petitions tablist must have a non-empty aria-label').toBeTruthy()

  // Inner tablist must have a DIFFERENT aria-label from the outer feed tablist
  expect(
    innerLabel,
    'inner Petitions tablist aria-label must differ from the outer feed tablist aria-label',
  ).not.toBe(feedLabel)

  // Inner tabs (All/Signed) must also have valid aria-controls → panel associations
  await assertTablistAriaAssociations(page, '#feed-panel-petitions [role="tablist"]')
})
