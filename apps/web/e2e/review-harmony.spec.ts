/**
 * review-harmony.spec.ts — Phase C2: Bidirectional Reviews + Harmony Score E2E
 *
 * Coverage (5 scenarios):
 *  1. Sourcer submits a review of the seeker after a completed opt-in.
 *  2. Seeker's harmony badge reflects the new score (count=1).
 *  3. A second review of the same exchange by the same reviewer is blocked
 *     with a friendly error message.
 *  4. Seeker submits a review of the sourcer (other direction).
 *  5. Sourcer's harmony badge updates to reflect the seeker's review.
 *
 * Strategy:
 *  - Provision two test users (sourcer/post-author and seeker) via admin API.
 *  - Seed a post + opt-in + set status='completed' via admin client.
 *  - Drive UI end-to-end: open opt-in management list, click "Review seeker",
 *    interact with the star rating modal, submit, and assert the harmony badge.
 *  - For the sourcer-review direction the seeker sees a "Review sourcer" button
 *    on their completed opt-in post card.
 *  - Duplicate review: attempt second submit → assert friendly error alert visible.
 *
 * Run:
 *   cd apps/web && npx playwright test e2e/review-harmony.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test'
import {
  makeAdminClient,
  provisionVaultUser,
  deleteProvisionedUser,
  type VaultProvisionResult,
} from './helpers/vault-fixture'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_PASSWORD = 'Test-Review-123!'
const FIXED_TS = '20260604reviewharmony'
const SOURCER_EMAIL = `e2e+sourcer-${FIXED_TS}@feed.local`
const SEEKER_EMAIL  = `e2e+seeker-${FIXED_TS}@feed.local`
const POST_CONTENT  = `E2E review test post ${FIXED_TS}`

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let sourcerProvision: VaultProvisionResult
let seekerProvision: VaultProvisionResult
let postId: string
let optInId: string

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up any prior run with these fixed emails
  const { data: existing } = await admin.auth.admin.listUsers()
  for (const email of [SOURCER_EMAIL, SEEKER_EMAIL]) {
    const prior = existing?.users?.find((u) => u.email === email)
    if (prior) await deleteProvisionedUser(admin, prior.id)
  }

  // Provision sourcer (post author)
  sourcerProvision = await provisionVaultUser({
    adminClient: admin,
    email: SOURCER_EMAIL,
    password: USER_PASSWORD,
    fullName: 'Review Sourcer',
    phone: '5550003333',
    residentialAddress: { line1: '10 Sourcer Ln', city: 'Austin', state: 'TX', zip_code: '73301' },
  })

  // Provision seeker
  seekerProvision = await provisionVaultUser({
    adminClient: admin,
    email: SEEKER_EMAIL,
    password: USER_PASSWORD,
    fullName: 'Review Seeker',
    phone: '5550004444',
    residentialAddress: { line1: '20 Seeker Blvd', city: 'Austin', state: 'TX', zip_code: '73302' },
  })

  // Seed post as sourcer (max_seekers=1 so capacity section is shown)
  const { data: postRow, error: postErr } = await admin
    .from('posts')
    .insert({
      user_id: sourcerProvision.userId,
      content: POST_CONTENT,
      max_seekers: 1,
    })
    .select('id')
    .single()

  if (postErr || !postRow) {
    throw new Error(`Failed to seed review test post: ${postErr?.message}`)
  }
  postId = postRow.id
  console.log(`[review-harmony] seeded post ${postId}`)

  // Seed opt-in as seeker then set status='completed' via admin
  const { data: optInRow, error: optInErr } = await admin
    .from('resource_opt_ins')
    .insert({
      post_id: postId,
      seeker_id: seekerProvision.userId,
      status: 'completed',
    })
    .select('id')
    .single()

  if (optInErr || !optInRow) {
    throw new Error(`Failed to seed opt-in: ${optInErr?.message}`)
  }
  optInId = optInRow.id
  console.log(`[review-harmony] seeded opt-in ${optInId} (status=completed)`)
})

test.afterAll(async () => {
  try {
    // Delete reviews first (FK cascade from opt-in, but be explicit)
    await admin.from('reviews').delete().eq('opt_in_id', optInId)
    if (postId) await admin.from('posts').delete().eq('id', postId)
    if (sourcerProvision?.userId) await deleteProvisionedUser(admin, sourcerProvision.userId)
    if (seekerProvision?.userId) await deleteProvisionedUser(admin, seekerProvision.userId)
  } catch (err) {
    console.error('[review-harmony] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Helper: login and navigate to Feed panel
// ---------------------------------------------------------------------------

async function loginAndNavigateToFeed(
  page: import('@playwright/test').Page,
  email: string,
  password: string
) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })
  await page.locator('[data-testid="sidebar-feed"]').click()
  await expect(page.locator('[role="tabpanel"]#feed-panel-feed')).toBeVisible({ timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// Test 1 + 2: Sourcer reviews seeker → seeker harmony badge shows score
// ---------------------------------------------------------------------------

test('sourcer reviews seeker after completed opt-in → seeker harmony badge shows score', async ({ page }) => {
  await loginAndNavigateToFeed(page, SOURCER_EMAIL, USER_PASSWORD)

  // Locate the post card
  const postCard = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })
  console.log('[review-harmony] post card visible')

  // Open the opt-in management list
  const manageBtn = postCard.locator(`[data-testid="opt-in-manage-${postId}"]`)
  await expect(manageBtn).toBeVisible({ timeout: 10_000 })
  await manageBtn.click()
  console.log('[review-harmony] opt-in list opened')

  // The opt-in should be visible with "completed" status and a "Review seeker" button
  const reviewBtn = postCard.locator('button', { hasText: 'Review seeker' })
  await expect(reviewBtn).toBeVisible({ timeout: 5_000 })
  await reviewBtn.click()
  console.log('[review-harmony] review modal opened')

  // Review modal should be visible
  const reviewStars = page.locator('[data-testid="review-stars"]')
  await expect(reviewStars).toBeVisible({ timeout: 5_000 })

  // Select 4 stars
  await page.locator('[data-testid="review-star-4"]').click()
  console.log('[review-harmony] selected 4 stars')

  // Toggle "Would recommend = Yes"
  await page.locator('[data-testid="review-recommend"]').click()

  // Submit
  const submitBtn = page.locator('[data-testid="review-submit"]')
  await expect(submitBtn).toBeEnabled({ timeout: 3_000 })
  await submitBtn.click()
  console.log('[review-harmony] review submitted')

  // Modal should close (dismiss); wait for it to disappear
  await expect(reviewStars).not.toBeVisible({ timeout: 10_000 })
  console.log('[review-harmony] review modal closed after submit')

  // After submission, refresh the page data (page.reload re-fetches)
  await page.reload()
  await page.locator('[data-testid="sidebar-feed"]').click()
  await expect(page.locator('[role="tabpanel"]#feed-panel-feed')).toBeVisible({ timeout: 15_000 })

  // Open the opt-in list again to see the seeker's harmony badge
  const postCard2 = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard2).toBeVisible({ timeout: 15_000 })

  await postCard2.locator(`[data-testid="opt-in-manage-${postId}"]`).click()

  // Seeker's harmony badge should now show a score (not "New")
  const seekerBadge = postCard2.locator(`[data-testid="harmony-badge-${seekerProvision.userId}"]`)
  await expect(seekerBadge).toBeVisible({ timeout: 10_000 })
  const badgeText = await seekerBadge.textContent()
  console.log('[review-harmony] seeker harmony badge text:', badgeText)
  // Badge should contain "4.00" (1 review of 4 stars) and "(1)"
  expect(badgeText).toContain('4.00')
  expect(badgeText).toContain('(1)')
})

// ---------------------------------------------------------------------------
// Test 3: Duplicate review attempt is blocked — UI hides button AND the
//         submit_review RPC returns a friendly "already reviewed" error when
//         called a second time for the same exchange/direction.
// ---------------------------------------------------------------------------

test('second review of same exchange by sourcer is blocked with friendly error', async ({ page }) => {
  await loginAndNavigateToFeed(page, SOURCER_EMAIL, USER_PASSWORD)

  const postCard = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })

  // 1. UI gate: "Review seeker" button must be absent (sourcer already reviewed in Test 1).
  const manageBtn = postCard.locator(`[data-testid="opt-in-manage-${postId}"]`)
  await expect(manageBtn).toBeVisible({ timeout: 10_000 })
  await manageBtn.click()

  const reviewBtn = postCard.locator('button', { hasText: 'Review seeker' })
  await expect(reviewBtn).not.toBeVisible({ timeout: 3_000 })
  console.log('[review-harmony] "Review seeker" button correctly hidden after review submitted')

  // 2. RPC gate: a second submit_review for the same opt-in/sourcer direction must
  //    return the unique_violation friendly message — proves the server-side guard
  //    is real and not just a UI elision.
  //    Strategy: sign in as the sourcer via signInWithPassword on a fresh anon-key
  //    client (Node-side, not browser), then call submit_review a second time.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const { createClient } = await import('@supabase/supabase-js')
  const sourcerClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: signInErr } = await sourcerClient.auth.signInWithPassword({
    email: SOURCER_EMAIL,
    password: USER_PASSWORD,
  })
  if (signInErr) throw new Error(`Sourcer sign-in failed for RPC test: ${signInErr.message}`)

  const { error: dupError } = await sourcerClient.rpc('submit_review', {
    p_opt_in_id: optInId,
    p_rating: 3,
    p_would_recommend: null,
    p_comment: null,
  })

  console.log('[review-harmony] duplicate RPC error message:', dupError?.message)
  expect(dupError).not.toBeNull()
  // The SECDEF function raises EXCEPTION 'You have already reviewed this exchange'
  // which PostgREST surfaces verbatim in the error message.
  expect(dupError!.message).toMatch(/already reviewed/i)

  await sourcerClient.auth.signOut()
})

// ---------------------------------------------------------------------------
// Test 4 + 5: Seeker reviews sourcer → sourcer harmony badge updates
// ---------------------------------------------------------------------------

test('seeker reviews sourcer → sourcer harmony badge updates', async ({ page }) => {
  await loginAndNavigateToFeed(page, SEEKER_EMAIL, USER_PASSWORD)

  // Locate the post card — seeker should see a "Review sourcer" button
  const postCard = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })

  const reviewSourcerBtn = postCard.locator(`[data-testid="review-sourcer-${postId}"]`)
  await expect(reviewSourcerBtn).toBeVisible({ timeout: 10_000 })
  console.log('[review-harmony] "Review sourcer" button visible for seeker')

  await reviewSourcerBtn.click()

  // Review modal
  const reviewStars = page.locator('[data-testid="review-stars"]')
  await expect(reviewStars).toBeVisible({ timeout: 5_000 })

  // Select 5 stars
  await page.locator('[data-testid="review-star-5"]').click()
  console.log('[review-harmony] seeker selected 5 stars')

  // Submit
  const submitBtn = page.locator('[data-testid="review-submit"]')
  await expect(submitBtn).toBeEnabled({ timeout: 3_000 })
  await submitBtn.click()
  console.log('[review-harmony] seeker review submitted')

  // Modal closes
  await expect(reviewStars).not.toBeVisible({ timeout: 10_000 })
  console.log('[review-harmony] review modal closed')

  // Reload to get fresh data
  await page.reload()
  await page.locator('[data-testid="sidebar-feed"]').click()
  await expect(page.locator('[role="tabpanel"]#feed-panel-feed')).toBeVisible({ timeout: 15_000 })

  // The sourcer's harmony badge on the post card should now show 5.00 (1 review of 5 stars)
  const postCard2 = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard2).toBeVisible({ timeout: 15_000 })

  const sourcerBadge = postCard2.locator(`[data-testid="harmony-badge-${sourcerProvision.userId}"]`)
  await expect(sourcerBadge).toBeVisible({ timeout: 10_000 })
  const badgeText = await sourcerBadge.textContent()
  console.log('[review-harmony] sourcer harmony badge text:', badgeText)
  expect(badgeText).toContain('5.00')
  expect(badgeText).toContain('(1)')

  // "Review sourcer" button should be gone (seeker already reviewed)
  const reviewBtn2 = postCard2.locator(`[data-testid="review-sourcer-${postId}"]`)
  await expect(reviewBtn2).not.toBeVisible({ timeout: 3_000 })
  console.log('[review-harmony] "Review sourcer" button hidden after seeker review')
})
