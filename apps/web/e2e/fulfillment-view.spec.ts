/**
 * fulfillment-view.spec.ts — P9-T1: Provider Fulfillment View E2E
 *
 * Covers the provider-side opt-in management lifecycle:
 *  1. Provider sees "N opted in" toggle on their own resource post.
 *  2. Provider expands Seekers accordion — seeker name + status badge visible.
 *  3. Provider accepts pending opt-in → badge transitions to "accepted".
 *  4. Provider marks accepted opt-in as completed → badge shows "completed";
 *     DB row status = 'completed'.
 *
 * Actual opt-in lifecycle verified: opt_in_to_post inserts with status='pending'.
 * Provider path: pending → accepted → completed (or pending → declined).
 * The Mark Complete button only appears for accepted rows (confirmed in feed-panel.tsx).
 *
 * Strategy:
 *  - Two test users: provider (post author) + seeker.
 *  - Seed resource post with max_seekers=3 so capacity doesn't interfere.
 *  - Seeker opts in via the opt_in_to_post RPC (real authenticated call).
 *  - Provider logs in, expands Seekers accordion, exercises Accept → Mark Complete.
 *  - Assert DOM badge flip + DB row status via admin client.
 *
 * Run:
 *   cd apps/web && npx playwright test e2e/fulfillment-view.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test'
import {
  makeAdminClient,
  provisionVaultUser,
  deleteProvisionedUser,
  type VaultProvisionResult,
} from './helpers/vault-fixture'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_PASSWORD = 'Test-Fulfill-123!'
const FIXED_TS = '20260611fulfillview'
const PROVIDER_EMAIL = `e2e+fv-provider-${FIXED_TS}@feed.local`
const SEEKER_EMAIL = `e2e+fv-seeker-${FIXED_TS}@feed.local`
const POST_CONTENT = `E2E fulfillment-view test post ${FIXED_TS}`

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let providerProvision: VaultProvisionResult
let seekerProvision: VaultProvisionResult
let postId: string
let optInId: string

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Remove any prior-run artefacts with these fixed emails
  const { data: existing } = await admin.auth.admin.listUsers()
  for (const email of [PROVIDER_EMAIL, SEEKER_EMAIL]) {
    const prior = existing?.users?.find((u) => u.email === email)
    if (prior) await deleteProvisionedUser(admin, prior.id)
  }

  // Provision provider
  providerProvision = await provisionVaultUser({
    adminClient: admin,
    email: PROVIDER_EMAIL,
    password: USER_PASSWORD,
    fullName: 'FV Provider User',
    phone: '5559990001',
    residentialAddress: { line1: '1 Provider St', city: 'Burlington', state: 'VT', zip_code: '05401' },
  })

  // Provision seeker
  seekerProvision = await provisionVaultUser({
    adminClient: admin,
    email: SEEKER_EMAIL,
    password: USER_PASSWORD,
    fullName: 'FV Seeker User',
    phone: '5559990002',
    residentialAddress: { line1: '2 Seeker Rd', city: 'Montpelier', state: 'VT', zip_code: '05602' },
  })

  // Seed resource post (max_seekers=3, slots_remaining=3) as provider
  const { data: postRow, error: postErr } = await admin
    .from('posts')
    .insert({
      user_id: providerProvision.userId,
      content: POST_CONTENT,
      max_seekers: 3,
    })
    .select('id')
    .single()

  if (postErr || !postRow) {
    throw new Error(`Failed to seed post: ${postErr?.message}`)
  }
  postId = postRow.id
  console.log(`[fulfillment-view] seeded post ${postId}`)

  // Seed opt-in as seeker via opt_in_to_post RPC (real RPC, establishes pending status)
  // Use a seeker-scoped client so auth.uid() resolves to the seeker inside the SECDEF fn.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const seekerClient = createClient(supabaseUrl, supabaseAnonKey)
  const { error: signInErr } = await seekerClient.auth.signInWithPassword({
    email: SEEKER_EMAIL,
    password: USER_PASSWORD,
  })
  if (signInErr) throw new Error(`Failed to sign in seeker: ${signInErr.message}`)

  const { data: optInRow, error: optInErr } = await seekerClient.rpc('opt_in_to_post', {
    p_post_id: postId,
  })
  if (optInErr) throw new Error(`Failed to opt in as seeker: ${optInErr.message}`)
  optInId = (optInRow as { id: string }).id
  console.log(`[fulfillment-view] seeker opted in — opt_in id ${optInId}`)

  await seekerClient.auth.signOut()
})

test.afterAll(async () => {
  try {
    // resource_opt_ins cascade-deletes when post is deleted
    if (postId) await admin.from('posts').delete().eq('id', postId)
    if (providerProvision?.userId) await deleteProvisionedUser(admin, providerProvision.userId)
    if (seekerProvision?.userId) await deleteProvisionedUser(admin, seekerProvision.userId)
  } catch (err) {
    console.error('[fulfillment-view] afterAll cleanup (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Helper: login and navigate to Feed panel
// ---------------------------------------------------------------------------

async function loginAndGoToFeed(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
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
// Tests
// ---------------------------------------------------------------------------

test('provider sees opted-in count on own resource post', async ({ page }) => {
  await loginAndGoToFeed(page, PROVIDER_EMAIL, USER_PASSWORD)

  const postCard = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })

  // Provider sees the "N opted in" toggle, not the seeker Opt In button
  const manageBtn = postCard.locator(`[data-testid="opt-in-manage-${postId}"]`)
  await expect(manageBtn).toBeVisible({ timeout: 10_000 })
  await expect(manageBtn).toContainText(/opted in/)
  console.log('[fulfillment-view] provider sees opted-in count toggle')
})

test('provider expands Seekers accordion and sees seeker with pending badge', async ({ page }) => {
  await loginAndGoToFeed(page, PROVIDER_EMAIL, USER_PASSWORD)

  const postCard = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })

  // Expand the Seekers accordion
  const manageBtn = postCard.locator(`[data-testid="opt-in-manage-${postId}"]`)
  await expect(manageBtn).toBeVisible({ timeout: 10_000 })
  await manageBtn.click()

  // Seeker name should appear in the expanded list
  const seekerRow = postCard.getByText('FV Seeker User')
  await expect(seekerRow).toBeVisible({ timeout: 10_000 })
  console.log('[fulfillment-view] seeker name visible in accordion')

  // Status badge should say "pending"
  const pendingBadge = postCard.locator('span', { hasText: 'pending' }).first()
  await expect(pendingBadge).toBeVisible({ timeout: 5_000 })
  console.log('[fulfillment-view] pending badge visible')

  // Accept button should be visible
  const acceptBtn = postCard.locator(`[data-testid="accept-optin-${optInId}"]`)
  await expect(acceptBtn).toBeVisible({ timeout: 5_000 })
  console.log('[fulfillment-view] Accept button visible for pending opt-in')
})

test('provider accepts opt-in → badge transitions to accepted', async ({ page }) => {
  // Ensure opt-in is pending (reset in case prior test left it in another state)
  await admin
    .from('resource_opt_ins')
    .update({ status: 'pending' })
    .eq('id', optInId)

  await loginAndGoToFeed(page, PROVIDER_EMAIL, USER_PASSWORD)

  const postCard = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })

  // Expand accordion
  const manageBtn = postCard.locator(`[data-testid="opt-in-manage-${postId}"]`)
  await expect(manageBtn).toBeVisible({ timeout: 10_000 })
  await manageBtn.click()

  // Click Accept
  const acceptBtn = postCard.locator(`[data-testid="accept-optin-${optInId}"]`)
  await expect(acceptBtn).toBeVisible({ timeout: 10_000 })
  await acceptBtn.click()
  console.log('[fulfillment-view] Accept clicked')

  // After page refresh (fetchPosts re-runs), re-open accordion and check badge
  // Wait for pending badge to disappear and accepted to appear
  await page.waitForTimeout(2_000) // allow fetchPosts to complete
  const manageBtnAfter = postCard.locator(`[data-testid="opt-in-manage-${postId}"]`)
  await expect(manageBtnAfter).toBeVisible({ timeout: 15_000 })
  await manageBtnAfter.click()

  const acceptedBadge = postCard.locator('span', { hasText: 'accepted' }).first()
  await expect(acceptedBadge).toBeVisible({ timeout: 10_000 })
  console.log('[fulfillment-view] accepted badge visible')

  // Mark Complete button should now be visible
  const completeBtn = postCard.locator(`[data-testid="complete-optin-${optInId}"]`)
  await expect(completeBtn).toBeVisible({ timeout: 5_000 })
  console.log('[fulfillment-view] Mark Completed button visible for accepted opt-in')
})

test('provider marks opt-in completed → badge shows completed and DB status = completed', async ({ page }) => {
  // Ensure opt-in is in accepted state
  await admin
    .from('resource_opt_ins')
    .update({ status: 'accepted' })
    .eq('id', optInId)

  await loginAndGoToFeed(page, PROVIDER_EMAIL, USER_PASSWORD)

  const postCard = page.locator(`[data-testid="post-${postId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })

  // Expand accordion
  const manageBtn = postCard.locator(`[data-testid="opt-in-manage-${postId}"]`)
  await expect(manageBtn).toBeVisible({ timeout: 10_000 })
  await manageBtn.click()

  // Mark Completed
  const completeBtn = postCard.locator(`[data-testid="complete-optin-${optInId}"]`)
  await expect(completeBtn).toBeVisible({ timeout: 10_000 })
  await completeBtn.click()
  console.log('[fulfillment-view] Mark Completed clicked')

  // Allow fetchPosts to complete, then re-expand and assert badge
  await page.waitForTimeout(2_000)
  const manageBtnAfter = postCard.locator(`[data-testid="opt-in-manage-${postId}"]`)
  await expect(manageBtnAfter).toBeVisible({ timeout: 15_000 })
  await manageBtnAfter.click()

  const completedBadge = postCard.locator('span', { hasText: 'completed' }).first()
  await expect(completedBadge).toBeVisible({ timeout: 10_000 })
  console.log('[fulfillment-view] completed badge visible in DOM')

  // DB assertion — verify the row status was persisted
  const { data: dbRow, error: dbErr } = await admin
    .from('resource_opt_ins')
    .select('status, completed_at')
    .eq('id', optInId)
    .single()

  expect(dbErr).toBeNull()
  expect(dbRow?.status).toBe('completed')
  console.log(`[fulfillment-view] DB row status='completed', completed_at=${dbRow?.completed_at}`)
})
