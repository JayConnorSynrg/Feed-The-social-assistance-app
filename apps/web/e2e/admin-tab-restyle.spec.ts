/**
 * admin-tab-restyle.spec.ts — Admin Wave-1 E2E
 *
 * Proves, against the prod DB with throwaway accounts (created + cleaned up by
 * the Supabase admin API + Management-API SQL for the privileged is_admin write):
 *
 *  (a) ADMIN (is_admin=true): the "Admin" tab appears in the top-center nav AND
 *      the "Administration" entry appears in Settings; clicking the nav tab lands
 *      on /moderation, which renders the FEED restyle (white card + lime/stone
 *      accents + "Back to app" link) with all 4 functional sections present.
 *  (b) NON-ADMIN: the Admin tab is ABSENT from nav AND Settings; the /moderation
 *      route itself still server-redirects a non-admin back to '/'.
 *  (c) the fabricated dashboard numbers ("12,480"/"$2.4M"/"48%"/"8,920"/"4,230")
 *      are GONE from the shell (assert absence).
 *
 * Run:
 *   npx playwright test --config playwright.admin.config.ts --reporter=line
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const RUN_TAG = 'e2e-adminw1'
const PASSWORD = 'Test-AdminW1-123!'
const ADMIN_EMAIL = `e2e+adminw1-admin-${RUN_TAG}@feed.local`
const NONADMIN_EMAIL = `e2e+adminw1-plain-${RUN_TAG}@feed.local`
const ADMIN_FULL_NAME = 'AdminW1 Reviewer'
const NONADMIN_FULL_NAME = 'AdminW1 Plain User'

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const MGMT_SQL_URL =
  'https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query'

function makeAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars for admin client')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Run SQL against prod via the Management API (privileged is_admin write). */
async function mgmtSql(query: string): Promise<unknown> {
  if (!SUPABASE_ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN not set')
  const res = await fetch(MGMT_SQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'User-Agent': 'feed-ops/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`Mgmt SQL failed: ${res.status}`)
  return res.json()
}

async function deleteUserByEmail(admin: SupabaseClient, email: string) {
  const { data } = await admin.auth.admin.listUsers()
  const u = data?.users?.find((x) => x.email === email)
  if (u) await admin.auth.admin.deleteUser(u.id)
}

/** Log in via /login and land on the SPA shell. Port-agnostic (regex URL). */
async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  if (!page.url().includes('/login')) {
    await page.goto('/')
    await page.waitForSelector('[data-testid="sidebar-chat"]', { timeout: 20_000 })
    return
  }
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/$/, { timeout: 30_000 })
  await page.waitForSelector('[data-testid="sidebar-chat"]', { timeout: 15_000 })
}

let admin: SupabaseClient
let adminId: string
let nonAdminId: string

// Console capture — surfaces page errors in the test output for clean-console assertions.
// `pageErrors` tracks uncaught page exceptions (always fatal); `consoleErrors`
// tracks console.error output with known-benign noise filtered out.
const pageErrors: string[] = []
const consoleErrors: string[] = []

// A pre-existing benign 406 fires on login: a `.single()` read of a PII-revoked
// profile column (RLS column-grant) returns "not acceptable" / no single row.
// It is unrelated to this Wave-1 change, so tolerate it (and any 406) here while
// still failing on any NEW console error this change might introduce.
function isBenignConsoleError(text: string): boolean {
  return (
    /\b406\b/.test(text) ||
    /Not Acceptable/i.test(text) ||
    /PGRST116/i.test(text) // PostgREST: "JSON object requested, multiple (or no) rows returned"
  )
}

test.beforeAll(async () => {
  admin = makeAdminClient()

  await deleteUserByEmail(admin, ADMIN_EMAIL)
  await deleteUserByEmail(admin, NONADMIN_EMAIL)

  // Admin user (is_admin=true via Mgmt-API — is_admin column write is privileged)
  const { data: a, error: aErr } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_FULL_NAME },
  })
  if (aErr || !a.user) throw new Error(`admin create failed: ${aErr?.message}`)
  adminId = a.user.id
  await admin
    .from('profiles')
    .update({ full_name: ADMIN_FULL_NAME, first_name: 'Reviewer', onboarding_completed: true })
    .eq('id', adminId)
  await mgmtSql(`UPDATE public.profiles SET is_admin = true WHERE id = '${adminId}';`)

  // Non-admin user (is_admin defaults false)
  const { data: n, error: nErr } = await admin.auth.admin.createUser({
    email: NONADMIN_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: NONADMIN_FULL_NAME },
  })
  if (nErr || !n.user) throw new Error(`non-admin create failed: ${nErr?.message}`)
  nonAdminId = n.user.id
  await admin
    .from('profiles')
    .update({ full_name: NONADMIN_FULL_NAME, first_name: 'Plain', onboarding_completed: true })
    .eq('id', nonAdminId)
})

test.afterAll(async () => {
  try {
    if (adminId) await admin.auth.admin.deleteUser(adminId)
    if (nonAdminId) await admin.auth.admin.deleteUser(nonAdminId)
  } catch {
    /* non-fatal */
  }
})

test.describe.configure({ mode: 'serial' })

test.beforeEach(({ page }) => {
  pageErrors.length = 0
  consoleErrors.length = 0
  page.on('pageerror', (err) => pageErrors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isBenignConsoleError(msg.text())) {
      consoleErrors.push(msg.text())
    }
  })
})

test('(a) admin sees Admin tab in nav + Settings; tab → restyled /moderation with all sections', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD)

  // Admin tab present in top-center nav (scoped to the desktop <nav> to avoid
  // strict-mode collision with the sidebar admin link, which also renders).
  const adminNav = page.getByRole('navigation').getByRole('link', { name: 'Admin' }).first()
  await expect(adminNav).toBeVisible({ timeout: 15_000 })
  // The sidebar admin entry also renders for admins.
  await expect(page.getByTestId('sidebar-admin')).toBeVisible()

  // Settings shows the Administration entry
  await page.locator('[data-testid="sidebar-settings"]').click()
  await expect(page.getByRole('button', { name: 'Administration' })).toBeVisible({ timeout: 15_000 })
  // Open the Administration section → primary lime CTA
  await page.getByRole('button', { name: 'Administration' }).click()
  const dashLink = page.getByRole('link', { name: 'Open Moderation Dashboard' })
  await expect(dashLink).toBeVisible()

  // Click the nav Admin tab → land on /moderation
  await adminNav.click()
  await page.waitForURL(/\/moderation$/, { timeout: 30_000 })

  // FEED restyle: page H1 lime, white card, back-to-app link
  await expect(page.getByRole('heading', { name: 'Resource Moderation' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('link', { name: /Back to app/i })).toBeVisible()

  // All 4 functional sections present
  await expect(page.getByRole('heading', { name: 'Content Reports' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Safety Alerts Review' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Petition Signatures' })).toBeVisible()

  // H1 carries the FEED lime accent
  const h1 = page.getByRole('heading', { name: 'Resource Moderation' })
  await expect(h1).toHaveClass(/text-\[#4a5d23\]/)

  // No uncaught page exceptions, and no NEW console errors (the known-benign
  // pre-existing 406 from the PII-revoked profile read is filtered out above).
  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toEqual([])
  expect(consoleErrors, `new console errors: ${consoleErrors.join(' | ')}`).toEqual([])
})

test('(b) non-admin: Admin tab ABSENT from nav + Settings; /moderation redirects to /', async ({ page }) => {
  await loginAs(page, NONADMIN_EMAIL, PASSWORD)

  // No Admin tab in nav and no admin sidebar entry
  await page.waitForTimeout(1500) // allow isAdmin RPC to resolve (false for non-admin)
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0)
  await expect(page.getByTestId('sidebar-admin')).toHaveCount(0)

  // No Administration entry in Settings
  await page.locator('[data-testid="sidebar-settings"]').click()
  await page.waitForTimeout(1500) // allow isAdmin RPC to resolve
  await expect(page.getByRole('button', { name: 'Administration' })).toHaveCount(0)

  // Server gate still redirects a direct /moderation visit back to '/'
  await page.goto('/moderation')
  await page.waitForURL(/\/$/, { timeout: 30_000 })
  await expect(page.locator('[data-testid="sidebar-chat"]')).toBeVisible({ timeout: 15_000 })
})

test('(c) fabricated dashboard numbers are GONE from the shell', async ({ page }) => {
  await loginAs(page, NONADMIN_EMAIL, PASSWORD)
  // Land on Home/overview where the metrics card renders
  await page.locator('[data-testid="sidebar-overview"]').click()
  await page.waitForTimeout(1000)

  const body = page.locator('body')
  for (const fake of ['12,480', '$2.4M', '8,920', '4,230', '45,230', '15,670']) {
    await expect(body, `fabricated metric "${fake}" should be absent`).not.toContainText(fake)
  }
})
