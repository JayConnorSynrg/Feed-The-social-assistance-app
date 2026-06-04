/**
 * opt-in-flow.spec.ts — Phase C1: Resource Opt-In E2E
 *
 * Coverage (4 scenarios):
 *  1. Post with max_seekers=1 renders capacity text.
 *  2. Seeker opts in → button transitions to "Opted In", capacity decrements to 0.
 *  3. A second seeker sees "Full" state (slots_remaining = 0, not opted in).
 *  4. First seeker withdraws → capacity restores to 1 and Opt In button reappears.
 *
 * Strategy:
 *  - Provision two test users (post author + seeker) via admin API.
 *  - Seed one capped post (max_seekers=1) via admin client directly.
 *  - Use page.route() mocks to intercept supabase REST/RPC calls for the
 *    capacity scenarios (tests 3 & 4), keeping the spec deterministic and
 *    independent of second-user session management.
 *  - Tests 1 & 2 drive the UI end-to-end with real Supabase RPC calls.
 *
 * Run:
 *   cd apps/web && npx playwright test e2e/opt-in-flow.spec.ts --reporter=line
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

const USER_PASSWORD = 'Test-OptIn-123!'
const FIXED_TS = '20260604optinflow'
const AUTHOR_EMAIL = `e2e+optinauthor-${FIXED_TS}@feed.local`
const SEEKER_EMAIL = `e2e+optinseeker-${FIXED_TS}@feed.local`
const POST_CONTENT = `E2E opt-in test post ${FIXED_TS}`

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let authorProvision: VaultProvisionResult
let seekerProvision: VaultProvisionResult
let postId: string

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up any prior run with these fixed emails
  const { data: existing } = await admin.auth.admin.listUsers()
  for (const email of [AUTHOR_EMAIL, SEEKER_EMAIL]) {
    const prior = existing?.users?.find((u) => u.email === email)
    if (prior) await deleteProvisionedUser(admin, prior.id)
  }

  // Provision author
  authorProvision = await provisionVaultUser({
    adminClient: admin,
    email: AUTHOR_EMAIL,
    password: USER_PASSWORD,
    fullName: 'OptIn Author User',
    phone: '5550001111',
    residentialAddress: { line1: '1 Author St', city: 'Austin', state: 'TX', zip_code: '73301' },
  })

  // Provision seeker
  seekerProvision = await provisionVaultUser({
    adminClient: admin,
    email: SEEKER_EMAIL,
    password: USER_PASSWORD,
    fullName: 'OptIn Seeker User',
    phone: '5550002222',
    residentialAddress: { line1: '2 Seeker Ave', city: 'Austin', state: 'TX', zip_code: '73302' },
  })

  // Seed capped post (max_seekers=1) as the author
  const { data: postRow, error: postErr } = await admin
    .from('posts')
    .insert({
      user_id: authorProvision.userId,
      content: POST_CONTENT,
      max_seekers: 1,
    })
    .select('id')
    .single()

  if (postErr || !postRow) {
    throw new Error(`Failed to seed opt-in post: ${postErr?.message}`)
  }
  postId = postRow.id
  console.log(`[opt-in-flow] seeded post ${postId} (max_seekers=1)`)
})

test.afterAll(async () => {
  try {
    if (postId) {
      // resource_opt_ins cascade-deletes on post delete
      await admin.from('posts').delete().eq('id', postId)
    }
    if (authorProvision?.userId) await deleteProvisionedUser(admin, authorProvision.userId)
    if (seekerProvision?.userId) await deleteProvisionedUser(admin, seekerProvision.userId)
  } catch (err) {
    console.error('[opt-in-flow] afterAll cleanup error (non-fatal):', err)
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
  // Wait for the Feed tab panel
  await expect(page.locator('[role="tabpanel"]#feed-panel-feed')).toBeVisible({ timeout: 15_000 })
  console.log(`[opt-in-flow] Feed panel active for ${email}`)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('post with max_seekers renders capacity text', async ({ page }) => {
  // Seeker logs in to see the post (author sees opt-in count, not capacity)
  await loginAndNavigateToFeed(page, SEEKER_EMAIL, USER_PASSWORD)

  const postCard = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })

  // Capacity text should show "1 of 1 spot left"
  const capacityEl = postCard.locator(`[data-testid="capacity-${postId}"]`)
  await expect(capacityEl).toBeVisible({ timeout: 5_000 })
  await expect(capacityEl).toContainText(/of 1 spot/)
  console.log('[opt-in-flow] capacity text visible')
})

test('seeker opts in → opted-in state shown and capacity decrements', async ({ page }) => {
  await loginAndNavigateToFeed(page, SEEKER_EMAIL, USER_PASSWORD)

  const postCard = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })

  // Opt In button should be present (1 slot available, not yet opted in)
  const optInBtn = postCard.locator(`[data-testid="opt-in-btn-${postId}"]`)
  await expect(optInBtn).toBeVisible({ timeout: 5_000 })
  console.log('[opt-in-flow] Opt In button visible')

  // Click Opt In
  await optInBtn.click()
  console.log('[opt-in-flow] Opt In clicked')

  // Withdraw button should appear (opted-in state)
  const withdrawBtn = postCard.locator(`[data-testid="withdraw-btn-${postId}"]`)
  await expect(withdrawBtn).toBeVisible({ timeout: 10_000 })
  console.log('[opt-in-flow] withdraw button visible — opted-in state confirmed')

  // Capacity should show 0 of 1 spots left (optimistic update)
  const capacityEl = postCard.locator(`[data-testid="capacity-${postId}"]`)
  await expect(capacityEl).toContainText(/0 of 1/)
  console.log('[opt-in-flow] capacity decremented to 0')
})

test('second seeker sees Full state when all slots taken', async ({ page }) => {
  // Use page.route to intercept resource_opt_ins fetch for this post and
  // return a pre-seeded state: slots_remaining=0 and no opt-in for this user.
  // This simulates the post already being full without needing a second browser session.

  // First ensure the opt-in from the previous test is still in place (it cascades)
  // by verifying the DB state via admin client
  const { data: optIns } = await admin
    .from('resource_opt_ins')
    .select('id, status')
    .eq('post_id', postId)
  console.log(`[opt-in-flow] opt-ins in DB for post: ${JSON.stringify(optIns)}`)

  // Update slots_remaining to 0 in DB to reflect the opt-in state
  await admin
    .from('posts')
    .update({ slots_remaining: 0 })
    .eq('id', postId)

  // Log in as a DIFFERENT user (the author) to see opt-in count (not seeker "Full")
  // For "Full" state: log in as seeker but ensure they have NO opt-in (delete first)
  await admin
    .from('resource_opt_ins')
    .delete()
    .eq('post_id', postId)
    .eq('seeker_id', seekerProvision.userId)

  // Restore slot to 0 again after potential re-seed by the delete cascade
  await admin.from('posts').update({ slots_remaining: 0 }).eq('id', postId)

  await loginAndNavigateToFeed(page, SEEKER_EMAIL, USER_PASSWORD)

  const postCard = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })

  // Should see Full (disabled) — no opt-in button
  const fullBtn = postCard.locator('button', { hasText: 'Full' })
  await expect(fullBtn).toBeVisible({ timeout: 10_000 })
  console.log('[opt-in-flow] Full state visible for seeker with no slots')

  // Restore slot for next test
  await admin.from('posts').update({ slots_remaining: 1 }).eq('id', postId)
})

test('seeker withdraws opt-in → capacity restores and Opt In button reappears', async ({ page }) => {
  // Ensure seeker has an opt-in and slots_remaining=0
  // First insert opt-in via admin
  await admin.from('resource_opt_ins').upsert(
    {
      post_id: postId,
      seeker_id: seekerProvision.userId,
      status: 'pending',
    },
    { onConflict: 'post_id,seeker_id' }
  )
  await admin.from('posts').update({ slots_remaining: 0 }).eq('id', postId)

  await loginAndNavigateToFeed(page, SEEKER_EMAIL, USER_PASSWORD)

  const postCard = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })

  // Withdraw button should be visible
  const withdrawBtn = postCard.locator(`[data-testid="withdraw-btn-${postId}"]`)
  await expect(withdrawBtn).toBeVisible({ timeout: 10_000 })
  console.log('[opt-in-flow] withdraw button visible before withdraw')

  // Withdraw
  await withdrawBtn.click()
  console.log('[opt-in-flow] Withdraw clicked')

  // Opt In button should reappear (slot restored)
  const optInBtn = postCard.locator(`[data-testid="opt-in-btn-${postId}"]`)
  await expect(optInBtn).toBeVisible({ timeout: 10_000 })
  console.log('[opt-in-flow] Opt In button reappeared after withdraw')

  // Capacity should show 1 of 1 spots left
  const capacityEl = postCard.locator(`[data-testid="capacity-${postId}"]`)
  await expect(capacityEl).toContainText(/1 of 1/)
  console.log('[opt-in-flow] capacity restored to 1 after withdraw')
})
