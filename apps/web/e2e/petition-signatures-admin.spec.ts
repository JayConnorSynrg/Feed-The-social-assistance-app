/**
 * petition-signatures-admin.spec.ts — Petition admin export + withdraw E2E
 *
 * Proves the full flow against the (migrated) prod DB with throwaway test data
 * that is created + cleaned up by name-pattern via the Management API SQL
 * endpoint (REST is RLS-blocked for service-role on these tables).
 *
 * Coverage:
 *  (a) an authed user signs a test petition → count increments
 *  (b) that user withdraws → count decrements, "Signed" reverts to the sign CTA
 *  (c) re-sign; admin opens /moderation → View signers shows the FULL name;
 *      Export CSV downloads the full legal record + sets exported_at
 *  (d) after export, the signer's panel shows the withdraw control GONE + the
 *      "final" note; calling withdraw now RAISES locked (RPC rejects)
 *  (e) the FAQ block renders with the copy
 *  + admin-gate: a NON-admin calling get_/export_petition_signatures is rejected
 *
 * Run:
 *   npx playwright test --config playwright.petition.config.ts --reporter=line
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants — name-pattern so the afterAll Mgmt-API sweep is deterministic
// ---------------------------------------------------------------------------

const RUN_TAG = 'e2e-petsig'
const PASSWORD = 'Test-PetSig-123!'
const SIGNER_EMAIL = `e2e+petsig-signer-${RUN_TAG}@feed.local`
const ADMIN_EMAIL = `e2e+petsig-admin-${RUN_TAG}@feed.local`
const SIGNER_FULL_NAME = 'Petition Signer FullLegal'
const ADMIN_FULL_NAME = 'Petition Admin Reviewer'
const PETITION_TITLE = `${RUN_TAG}-test-petition`

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const MGMT_SQL_URL =
  'https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars for admin client')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function anonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase anon env vars')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Run SQL against prod via the Management API (writes; RLS-bypassing). */
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
  if (!res.ok) {
    throw new Error(`Mgmt SQL failed: ${res.status}`)
  }
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

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let signerId: string
let adminId: string
let petitionId: string

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up any prior run
  await deleteUserByEmail(admin, SIGNER_EMAIL)
  await deleteUserByEmail(admin, ADMIN_EMAIL)
  await mgmtSql(
    `DELETE FROM public.petition_signatures WHERE petition_id IN (SELECT id FROM public.petitions WHERE title = '${PETITION_TITLE}');
     DELETE FROM public.petitions WHERE title = '${PETITION_TITLE}';`
  )

  // Signer user (regular)
  const { data: s, error: sErr } = await admin.auth.admin.createUser({
    email: SIGNER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: SIGNER_FULL_NAME },
  })
  if (sErr || !s.user) throw new Error(`signer create failed: ${sErr?.message}`)
  signerId = s.user.id
  await admin
    .from('profiles')
    .update({ full_name: SIGNER_FULL_NAME, first_name: 'Petition', onboarding_completed: true })
    .eq('id', signerId)

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

  // Create an approved test petition via Mgmt-API
  const insert = (await mgmtSql(
    `INSERT INTO public.petitions (title, summary, body, cause_category, target_signatures, body_version_hash, status, created_by)
     VALUES ('${PETITION_TITLE}', 'E2E throwaway petition summary', 'E2E throwaway petition body text.', 'housing', 100, 'e2ehash-${RUN_TAG}', 'approved', '${adminId}')
     RETURNING id;`
  )) as Array<{ id: string }>
  petitionId = insert[0].id
})

test.afterAll(async () => {
  // Remove all test rows from prod (signatures → petition → users)
  try {
    await mgmtSql(
      `DELETE FROM public.petition_signatures WHERE petition_id IN (SELECT id FROM public.petitions WHERE title = '${PETITION_TITLE}');
       DELETE FROM public.petitions WHERE title = '${PETITION_TITLE}';`
    )
  } catch {
    /* non-fatal */
  }
  try {
    if (signerId) await admin.auth.admin.deleteUser(signerId)
    if (adminId) await admin.auth.admin.deleteUser(adminId)
  } catch {
    /* non-fatal */
  }
})

// ---------------------------------------------------------------------------
// Tests (serial — each builds on the prior DB state)
// ---------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' })

test('(e) FAQ block renders with the privacy + withdraw + verified-signature copy', async ({ page }) => {
  await loginAs(page, SIGNER_EMAIL, PASSWORD)
  await page.locator('[data-testid="sidebar-petitions"]').click()
  await expect(page.locator('text=Community Petitions')).toBeVisible({ timeout: 15_000 })

  await page.locator('[data-testid="petition-faq-toggle"]').click()
  const faq = page.locator('[data-testid="petition-faq-content"]')
  await expect(faq).toBeVisible()
  await expect(faq).toContainText('Only administrators can see')
  await expect(faq).toContainText('withdraw your signature anytime')
  await expect(faq).toContainText('Verified signature of support')
})

test('(a) signer signs the test petition → count increments', async ({ page }) => {
  await loginAs(page, SIGNER_EMAIL, PASSWORD)
  await page.locator('[data-testid="sidebar-petitions"]').click()

  const card = page.locator(`[data-testid="petition-card-${petitionId}"]`)
  await expect(card).toBeVisible({ timeout: 15_000 })

  // Wait for the SERVER round-trip to complete (the UI updates optimistically,
  // so a DB read immediately after the click races the in-flight insert).
  const signResp = page.waitForResponse(
    (r) => r.url().includes('/api/petitions/sign') && r.request().method() === 'POST',
    { timeout: 25_000 }
  )
  await card.locator(`[data-testid="sign-${petitionId}"]`).click()
  const resp = await signResp
  expect(resp.status(), 'sign API should return 200').toBe(200)

  await expect(card.locator('text=Signed')).toBeVisible({ timeout: 10_000 })

  // Confirm DB row + full-name snapshot stamped server-side
  const rows = (await mgmtSql(
    `SELECT signer_full_name FROM public.petition_signatures WHERE petition_id = '${petitionId}' AND signer_id = '${signerId}';`
  )) as Array<{ signer_full_name: string }>
  expect(rows.length).toBe(1)
  expect(rows[0].signer_full_name).toBe(SIGNER_FULL_NAME)
})

test('(b) signer withdraws → count decrements, sign CTA returns', async ({ page }) => {
  await loginAs(page, SIGNER_EMAIL, PASSWORD)
  await page.locator('[data-testid="sidebar-petitions"]').click()

  const card = page.locator(`[data-testid="petition-card-${petitionId}"]`)
  await expect(card).toBeVisible({ timeout: 15_000 })

  const withdrawBtn = card.locator(`[data-testid="withdraw-${petitionId}"]`)
  await expect(withdrawBtn).toBeVisible({ timeout: 10_000 })
  await withdrawBtn.click()

  await expect(card.locator(`[data-testid="sign-${petitionId}"]`)).toBeVisible({ timeout: 10_000 })

  const rows = (await mgmtSql(
    `SELECT count(*)::int AS c FROM public.petition_signatures WHERE petition_id = '${petitionId}' AND signer_id = '${signerId}';`
  )) as Array<{ c: number }>
  expect(rows[0].c).toBe(0)
})

test('admin-gate: non-admin (signer) calling the RPCs is rejected', async () => {
  const client = anonClient()
  const { error: signInErr } = await client.auth.signInWithPassword({
    email: SIGNER_EMAIL,
    password: PASSWORD,
  })
  expect(signInErr).toBeNull()

  const get = await client.rpc('get_petition_signatures', { p_petition_id: petitionId })
  expect(get.error, 'non-admin get_petition_signatures must be rejected').not.toBeNull()
  expect(get.error?.message ?? '').toMatch(/not authorized/i)

  const exp = await client.rpc('export_petition_signatures', { p_petition_id: petitionId })
  expect(exp.error, 'non-admin export_petition_signatures must be rejected').not.toBeNull()
  expect(exp.error?.message ?? '').toMatch(/not authorized/i)

  // Confirm the rejected export did NOT set the lock
  const rows = (await mgmtSql(
    `SELECT exported_at FROM public.petitions WHERE id = '${petitionId}';`
  )) as Array<{ exported_at: string | null }>
  expect(rows[0].exported_at).toBeNull()
})

test('(c) admin re-signs as signer, then views FULL name + Export CSV sets exported_at', async ({ page, context }) => {
  // Re-sign as signer so there is a signature to export
  await loginAs(page, SIGNER_EMAIL, PASSWORD)
  await page.locator('[data-testid="sidebar-petitions"]').click()
  const petitionCard = page.locator(`[data-testid="petition-card-${petitionId}"]`)
  await expect(petitionCard).toBeVisible({ timeout: 15_000 })
  const reSignResp = page.waitForResponse(
    (r) => r.url().includes('/api/petitions/sign') && r.request().method() === 'POST',
    { timeout: 25_000 }
  )
  await petitionCard.locator(`[data-testid="sign-${petitionId}"]`).click()
  await reSignResp
  await expect(petitionCard.locator('text=Signed')).toBeVisible({ timeout: 10_000 })

  // New context as admin → /moderation
  const adminPage = await context.browser()!.newContext().then((c) => c.newPage())
  await loginAs(adminPage, ADMIN_EMAIL, PASSWORD)
  await adminPage.goto('/moderation')

  const exportSection = adminPage.locator('[data-testid="petition-signatures-export"]')
  await expect(exportSection).toBeVisible({ timeout: 20_000 })

  const exportCard = adminPage.locator(`[data-testid="petition-export-${petitionId}"]`)
  await expect(exportCard).toBeVisible({ timeout: 10_000 })

  // View signers → FULL name visible (not the first-name display name)
  await exportCard.locator(`[data-testid="view-signers-${petitionId}"]`).click()
  const roster = adminPage.locator(`[data-testid="roster-${petitionId}"]`)
  await expect(roster).toBeVisible({ timeout: 10_000 })
  await expect(roster).toContainText(SIGNER_FULL_NAME)

  // Export CSV → triggers a download
  const downloadPromise = adminPage.waitForEvent('download', { timeout: 15_000 })
  await exportCard.locator(`[data-testid="export-signers-${petitionId}"]`).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/petition-signatures-.*\.csv/)

  // CSV contains the full legal record (full name + version hash)
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const csv = Buffer.concat(chunks).toString('utf-8')
  expect(csv).toContain('Full Name')
  expect(csv).toContain('Petition Version Hash')
  expect(csv).toContain(SIGNER_FULL_NAME)
  expect(csv).toContain(`e2ehash-${RUN_TAG}`)

  // exported_at is now set in the DB (the lock moment)
  const rows = (await mgmtSql(
    `SELECT exported_at FROM public.petitions WHERE id = '${petitionId}';`
  )) as Array<{ exported_at: string | null }>
  expect(rows[0].exported_at).not.toBeNull()

  await adminPage.close()
})

test('(d) after export the withdraw control is gone + the RPC rejects locked withdrawal', async ({ page }) => {
  await loginAs(page, SIGNER_EMAIL, PASSWORD)
  await page.locator('[data-testid="sidebar-petitions"]').click()

  const petitionCard = page.locator(`[data-testid="petition-card-${petitionId}"]`)
  await expect(petitionCard.locator('text=Signed')).toBeVisible({ timeout: 15_000 })

  // Withdraw control is GONE; the "final" note is shown instead
  await expect(page.locator(`[data-testid="withdraw-${petitionId}"]`)).toHaveCount(0)
  await expect(petitionCard).toContainText('Signatures are final')

  // The RPC itself rejects a locked withdrawal (defense in depth)
  const client = anonClient()
  await client.auth.signInWithPassword({ email: SIGNER_EMAIL, password: PASSWORD })
  const res = await client.rpc('withdraw_petition_signature', { p_petition_id: petitionId })
  expect(res.error, 'locked withdrawal must reject').not.toBeNull()
  expect(res.error?.message ?? '').toMatch(/locked|exported/i)

  // Signature still present (withdrawal blocked)
  const rows = (await mgmtSql(
    `SELECT count(*)::int AS c FROM public.petition_signatures WHERE petition_id = '${petitionId}' AND signer_id = '${signerId}';`
  )) as Array<{ c: number }>
  expect(rows[0].c).toBe(1)
})
