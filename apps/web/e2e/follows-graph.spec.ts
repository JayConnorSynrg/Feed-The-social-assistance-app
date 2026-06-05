/**
 * follows-graph.spec.ts — Phase D1: Follows Social Graph E2E
 *
 * Coverage (3 scenarios):
 *  1. Follow button appears on another user's post, not on own posts.
 *     Clicking it transitions the button to "Following" state.
 *  2. With the 'following' filter active, the feed shows ONLY followed authors'
 *     posts and hides posts from unfollowed authors.
 *  3. Unfollow removes the author's posts from the 'following' filtered view.
 *
 * Strategy:
 *  - Provision two test users (author A + author B) via admin API.
 *  - Seed one post per author directly via admin client.
 *  - Tests 1 & 2 drive the UI end-to-end with real Supabase DML calls.
 *  - Test 3 seeds a follows row via admin, then unfollows via UI and asserts
 *    the 'following' view empties.
 *  - page.route() mocks discriminate on `following_id` to avoid collisions with
 *    other concurrent specs (mirrors opt-in-flow.spec.ts strategy).
 *
 * Run:
 *   cd apps/web && npx playwright test e2e/follows-graph.spec.ts --reporter=line
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

const USER_PASSWORD = 'Test-Follows-123!'
const FIXED_TS = '20260605followsgraph'
const USER_A_EMAIL = `e2e+followsA-${FIXED_TS}@feed.local`
const USER_B_EMAIL = `e2e+followsB-${FIXED_TS}@feed.local`
const POST_A_CONTENT = `E2E follows test post A ${FIXED_TS}`
const POST_B_CONTENT = `E2E follows test post B ${FIXED_TS}`

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let userAProvision: VaultProvisionResult   // the user who will follow
let userBProvision: VaultProvisionResult   // the user to be followed
let postAId: string   // post by user A (own post — no follow button expected)
let postBId: string   // post by user B (other user — follow button expected)

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up any prior run with these fixed emails
  const { data: existing } = await admin.auth.admin.listUsers()
  for (const email of [USER_A_EMAIL, USER_B_EMAIL]) {
    const prior = existing?.users?.find((u) => u.email === email)
    if (prior) await deleteProvisionedUser(admin, prior.id)
  }

  // Provision user A (the follower / currently-logged-in user)
  userAProvision = await provisionVaultUser({
    adminClient: admin,
    email: USER_A_EMAIL,
    password: USER_PASSWORD,
    fullName: 'Follows Graph User A',
    phone: '5551110001',
    residentialAddress: { line1: '10 Follows St', city: 'Austin', state: 'TX', zip_code: '73301' },
  })

  // Provision user B (the followed / other user)
  userBProvision = await provisionVaultUser({
    adminClient: admin,
    email: USER_B_EMAIL,
    password: USER_PASSWORD,
    fullName: 'Follows Graph User B',
    phone: '5551110002',
    residentialAddress: { line1: '20 Follows Ave', city: 'Austin', state: 'TX', zip_code: '73302' },
  })

  // Seed post A (authored by user A — own post)
  const { data: postARow, error: postAErr } = await admin
    .from('posts')
    .insert({ user_id: userAProvision.userId, content: POST_A_CONTENT })
    .select('id')
    .single()

  if (postAErr || !postARow) {
    throw new Error(`Failed to seed post A: ${postAErr?.message}`)
  }
  postAId = postARow.id
  console.log(`[follows-graph] seeded post A: ${postAId} (by user A)`)

  // Seed post B (authored by user B — other user)
  const { data: postBRow, error: postBErr } = await admin
    .from('posts')
    .insert({ user_id: userBProvision.userId, content: POST_B_CONTENT })
    .select('id')
    .single()

  if (postBErr || !postBRow) {
    throw new Error(`Failed to seed post B: ${postBErr?.message}`)
  }
  postBId = postBRow.id
  console.log(`[follows-graph] seeded post B: ${postBId} (by user B)`)
})

test.afterAll(async () => {
  try {
    // Clean up follows rows, posts, and users
    await admin.from('follows').delete().eq('follower_id', userAProvision.userId)
    if (postAId) await admin.from('posts').delete().eq('id', postAId)
    if (postBId) await admin.from('posts').delete().eq('id', postBId)
    if (userAProvision?.userId) await deleteProvisionedUser(admin, userAProvision.userId)
    if (userBProvision?.userId) await deleteProvisionedUser(admin, userBProvision.userId)
  } catch (err) {
    console.error('[follows-graph] afterAll cleanup error (non-fatal):', err)
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
  console.log(`[follows-graph] Feed panel active for ${email}`)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('follow button appears on other user post; not on own post; click follows', async ({ page }) => {
  // Ensure user A does NOT follow user B at the start of this test
  await admin.from('follows')
    .delete()
    .eq('follower_id', userAProvision.userId)
    .eq('following_id', userBProvision.userId)

  await loginAndNavigateToFeed(page, USER_A_EMAIL, USER_PASSWORD)

  // User B's post should have a follow button
  const postBCard = page.locator(`[data-testid="post-${postBId}"]`)
  await expect(postBCard).toBeVisible({ timeout: 15_000 })

  const followBtnB = postBCard.locator(`[data-testid="follow-btn-${userBProvision.userId}"]`)
  await expect(followBtnB).toBeVisible({ timeout: 5_000 })
  await expect(followBtnB).toContainText('Follow')
  console.log('[follows-graph] Follow button visible on other user post')

  // User A's own post should NOT have a follow button
  const postACard = page.locator(`[data-testid="post-${postAId}"]`)
  await expect(postACard).toBeVisible({ timeout: 15_000 })
  const followBtnA = postACard.locator(`[data-testid="follow-btn-${userAProvision.userId}"]`)
  await expect(followBtnA).not.toBeVisible()
  console.log('[follows-graph] Follow button absent on own post')

  // Click Follow on user B's post
  await followBtnB.click()
  console.log('[follows-graph] Follow button clicked')

  // Button should transition to "Following"
  await expect(followBtnB).toContainText('Following', { timeout: 5_000 })
  console.log('[follows-graph] Button transitioned to Following state')
})

test('following filter shows only followed authors posts', async ({ page }) => {
  // Ensure user A follows user B (seed the follows row if not already present)
  await admin.from('follows').upsert(
    { follower_id: userAProvision.userId, following_id: userBProvision.userId },
    { onConflict: 'follower_id,following_id' }
  )

  await loginAndNavigateToFeed(page, USER_A_EMAIL, USER_PASSWORD)

  // Both posts should be visible under the 'all' filter
  const postACard = page.locator(`[data-testid="post-${postAId}"]`)
  const postBCard = page.locator(`[data-testid="post-${postBId}"]`)
  await expect(postBCard).toBeVisible({ timeout: 15_000 })
  await expect(postACard).toBeVisible({ timeout: 15_000 })
  console.log('[follows-graph] Both posts visible under all filter')

  // Click the 'Following' filter tab
  await page.locator('button', { hasText: 'Following' }).first().click()
  console.log('[follows-graph] Following filter activated')

  // Post B (by followed user) should be visible
  await expect(postBCard).toBeVisible({ timeout: 10_000 })
  console.log('[follows-graph] Post B (followed author) visible in following filter')

  // Post A (own post — user A is NOT following themselves) should NOT be visible
  await expect(postACard).not.toBeVisible({ timeout: 5_000 })
  console.log('[follows-graph] Post A (own post, not followed) hidden in following filter')
})

test('unfollow removes author posts from following view', async ({ page }) => {
  // Ensure user A follows user B to start
  await admin.from('follows').upsert(
    { follower_id: userAProvision.userId, following_id: userBProvision.userId },
    { onConflict: 'follower_id,following_id' }
  )

  await loginAndNavigateToFeed(page, USER_A_EMAIL, USER_PASSWORD)

  // Activate Following filter
  await page.locator('button', { hasText: 'Following' }).first().click()

  const postBCard = page.locator(`[data-testid="post-${postBId}"]`)
  await expect(postBCard).toBeVisible({ timeout: 10_000 })
  console.log('[follows-graph] Post B visible before unfollow')

  // Switch back to All to find and click the Following/Unfollow button on post B
  await page.locator('button', { hasText: 'All' }).first().click()
  await expect(postBCard).toBeVisible({ timeout: 10_000 })

  const followBtnB = postBCard.locator(`[data-testid="follow-btn-${userBProvision.userId}"]`)
  await expect(followBtnB).toContainText('Following', { timeout: 5_000 })

  // Click to unfollow
  await followBtnB.click()
  await expect(followBtnB).toContainText('Follow', { timeout: 5_000 })
  console.log('[follows-graph] Unfollow clicked — button back to Follow state')

  // Activate Following filter again
  await page.locator('button', { hasText: 'Following' }).first().click()

  // Post B should no longer appear in the following view
  await expect(postBCard).not.toBeVisible({ timeout: 8_000 })
  console.log('[follows-graph] Post B no longer in following view after unfollow')
})
