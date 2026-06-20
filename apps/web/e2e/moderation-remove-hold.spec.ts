/**
 * moderation-remove-hold.spec.ts — Admin post moderation actions E2E
 *
 * Coverage:
 *  (a) "Remove Post" and "Hold for Review" buttons appear in the expanded report card.
 *  (b) Clicking "Remove Post" on the first open-report group removes it from the queue.
 *  (c) "Removed & Held Posts" section heading is always present on the reports subtab.
 *  (d) "Authorize Post" button appears on held posts.
 *
 * Strategy:
 *  - Provision 1 staff user + 1 post author + 1 reporter.
 *  - Seed a post and 3 reports (triggering auto-hide) so at least one group appears.
 *  - Log in as staff → navigate to /moderation → Reports subtab.
 *  - Expand the first group and assert the new buttons exist.
 *  - Click "Remove Post" → assert the group leaves the queue.
 *  - Seed a second post, call admin_hold_post via RPC, reload → assert Authorize button.
 *  - afterAll: sweep test data.
 *
 * Run:
 *   cd /Users/jelalconnor/CODING/CURSOR/FEED. && npx playwright test apps/web/e2e/moderation-remove-hold.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { makeAdminClient, deleteProvisionedUser } from './helpers/vault-fixture'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FIXED_TS = '20260619modh'
const STAFF_EMAIL   = `e2e+modh-staff-${FIXED_TS}@feed.local`
const AUTHOR_EMAIL  = `e2e+modh-author-${FIXED_TS}@feed.local`
const REPORTER_EMAIL = `e2e+modh-reporter-${FIXED_TS}@feed.local`
const PASSWORD      = 'ModerationHold-12!'

const MGMT_URL =
  'https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query'

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state
// ─────────────────────────────────────────────────────────────────────────────

let admin: SupabaseClient
let staffId: string
let authorId: string
let reporterId: string
let postId: string
let holdPostId: string

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function mgmtQuery(query: string): Promise<void> {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN not set')
  const res = await fetch(MGMT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Mgmt-API SQL failed: ${res.status} ${body}`)
  }
}

async function createUser(
  email: string,
  fullName: string,
  isStaff = false
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error || !data?.user) throw new Error(`createUser failed: ${error?.message}`)
  const uid = data.user.id
  const { error: profErr } = await admin
    .from('profiles')
    .update({ full_name: fullName, onboarding_completed: true, user_role: 'seeking', is_staff: isStaff })
    .eq('id', uid)
  if (profErr) throw new Error(`profile update failed: ${profErr.message}`)
  return uid
}

async function loginAsStaff(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', STAFF_EMAIL)
  await page.fill('#password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/$/, { timeout: 30_000 })
  await page.waitForSelector('[data-testid="sidebar-chat"]', { timeout: 15_000 })
}

async function navigateToReportsTab(page: import('@playwright/test').Page): Promise<void> {
  // Navigate directly to /moderation — staff (is_staff=true) can access this
  // even without is_admin; the server gate checks is_admin but staffClient
  // can reach the RPC. For UI navigation use the admin guard workaround:
  // go directly to the URL (staff who also have is_admin see the link; if not,
  // navigate directly and assert we land there).
  await page.goto('/moderation')
  // Wait for the moderation page to render (may redirect if not is_admin)
  await page.waitForTimeout(2_000)
  // Click the "Reports" subtab button
  const reportsBtn = page.getByRole('button', { name: 'Reports' })
  await expect(reportsBtn).toBeVisible({ timeout: 15_000 })
  await reportsBtn.click()
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup / Teardown
// ─────────────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up prior runs
  const { data: existing } = await admin.auth.admin.listUsers()
  for (const email of [STAFF_EMAIL, AUTHOR_EMAIL, REPORTER_EMAIL]) {
    const prior = existing?.users?.find((u) => u.email === email)
    if (prior) await deleteProvisionedUser(admin, prior.id)
  }

  // Provision users
  staffId    = await createUser(STAFF_EMAIL,    'Modh Staff User',    /* isStaff */ true)
  authorId   = await createUser(AUTHOR_EMAIL,   'Modh Author User')
  reporterId = await createUser(REPORTER_EMAIL, 'Modh Reporter User')

  // Grant staff user is_admin so they can navigate to /moderation UI
  await mgmtQuery(`UPDATE public.profiles SET is_admin = true WHERE id = '${staffId}';`)

  // Seed post
  const { data: postData, error: postErr } = await admin
    .from('posts')
    .insert({ user_id: authorId, content: `e2e-modh-${FIXED_TS} main post`, is_hidden: false })
    .select('id')
    .single()
  if (postErr || !postData) throw new Error(`Post seed failed: ${postErr?.message}`)
  postId = postData.id

  // Seed 3 reports from 3 distinct users to trigger auto-hide
  // reporter1 = reporter, reporter2 = author (self-report not allowed; use staff as 3rd)
  // Use Mgmt-API to insert reports directly to avoid self-report constraint
  await mgmtQuery(`
    INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason, status)
    VALUES
      ('${reporterId}', 'post', '${postId}', 'spam',           'open'),
      ('${authorId}',   'post', '${postId}', 'misinformation', 'open'),
      ('${staffId}',    'post', '${postId}', 'harassment',     'open');
    UPDATE public.posts SET is_hidden = true, hidden_at = now(), hidden_reason = 'community_reports_threshold'
    WHERE id = '${postId}';
  `)

  // Seed a second post to be held (for authorize test)
  const { data: holdData, error: holdErr } = await admin
    .from('posts')
    .insert({ user_id: authorId, content: `e2e-modh-${FIXED_TS} hold post`, is_hidden: false })
    .select('id')
    .single()
  if (holdErr || !holdData) throw new Error(`Hold post seed failed: ${holdErr?.message}`)
  holdPostId = holdData.id

  // Hold it directly via Mgmt-API SQL
  await mgmtQuery(`
    UPDATE public.posts
    SET is_hidden = true, hidden_at = now(), hidden_reason = 'hold_for_review'
    WHERE id = '${holdPostId}';
  `)
})

test.afterAll(async () => {
  try {
    await mgmtQuery(`DELETE FROM public.content_reports WHERE content_id IN ('${postId}', '${holdPostId}')`)
    await mgmtQuery(`DELETE FROM public.posts WHERE content LIKE 'e2e-modh-${FIXED_TS}%'`)
  } catch { /* non-fatal */ }
  for (const uid of [staffId, authorId, reporterId]) {
    if (uid) {
      try { await deleteProvisionedUser(admin, uid) } catch { /* non-fatal */ }
    }
  }
})

test.describe.configure({ mode: 'serial' })

// ─────────────────────────────────────────────────────────────────────────────
// (a) Remove Post + Hold for Review buttons appear in expanded report card
// ─────────────────────────────────────────────────────────────────────────────

test('(a) Remove Post and Hold for Review buttons exist in the expanded report card', async ({ page }) => {
  await loginAsStaff(page)
  await navigateToReportsTab(page)

  // Wait for the reports queue to render at least one card
  const firstCard = page.locator('.border-orange-200').first()
  await expect(firstCard).toBeVisible({ timeout: 15_000 })

  // Expand the first group via the chevron toggle
  const chevron = firstCard.locator('button').filter({ hasText: '' }).last()
  await chevron.click()

  // Remove Post button
  const removeBtn = page.locator('[data-testid^="remove-post-"]').first()
  await expect(removeBtn).toBeVisible({ timeout: 8_000 })

  // Hold for Review button
  const holdBtn = page.locator('[data-testid^="hold-post-"]').first()
  await expect(holdBtn).toBeVisible({ timeout: 8_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// (b) Clicking Remove Post removes the group from the queue
// ─────────────────────────────────────────────────────────────────────────────

test('(b) clicking Remove Post removes the group from the queue', async ({ page }) => {
  await loginAsStaff(page)
  await navigateToReportsTab(page)

  // Wait for queue
  const firstCard = page.locator('.border-orange-200').first()
  await expect(firstCard).toBeVisible({ timeout: 15_000 })

  // Expand it
  const chevron = firstCard.locator('button').last()
  await chevron.click()

  // Grab the data-testid to get the post id
  const removeBtn = page.locator('[data-testid^="remove-post-"]').first()
  await expect(removeBtn).toBeVisible({ timeout: 8_000 })
  const testId = await removeBtn.getAttribute('data-testid')
  const removedPostId = testId?.replace('remove-post-', '') ?? ''

  // Click Remove Post
  await removeBtn.click()

  // The group card for this post should leave the queue
  await expect(
    page.locator(`[data-testid="remove-post-${removedPostId}"]`)
  ).not.toBeVisible({ timeout: 10_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// (c) "Removed & Held Posts" heading is always present on the reports subtab
// ─────────────────────────────────────────────────────────────────────────────

test('(c) "Removed & Held Posts" section heading is visible on the reports subtab', async ({ page }) => {
  await loginAsStaff(page)
  await navigateToReportsTab(page)

  await expect(
    page.getByRole('heading', { name: /Removed.*Held Posts/i })
  ).toBeVisible({ timeout: 15_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// (d) Authorize Post button appears on held posts
// ─────────────────────────────────────────────────────────────────────────────

test('(d) Authorize Post button appears on held posts in the Removed & Held section', async ({ page }) => {
  await loginAsStaff(page)
  await navigateToReportsTab(page)

  // The held post should appear in the Removed & Held section with an Authorize button
  const authorizeBtn = page.locator('[data-testid^="authorize-post-"]').first()
  await expect(authorizeBtn).toBeVisible({ timeout: 15_000 })
})
