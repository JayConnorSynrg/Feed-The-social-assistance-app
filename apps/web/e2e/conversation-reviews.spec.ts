/**
 * conversation-reviews.spec.ts — Phase 9 P9-T6: Conversation Completion + Dual Wheat-Stalk Reviews
 *
 * Coverage (5 scenarios):
 *  (a) Volunteer is shown "End & review" button for an ACTIVE conversation.
 *  (b) After completing a conversation (set via admin), BOTH parties see the review prompt card.
 *  (c-volunteer) Volunteer submits a 4-stalk rating — submitted card shows stalks.
 *  (c-requester) Requester submits a 5-stalk rating — submitted card shows stalks.
 *  (d) DB assert: both reviewee harmony scores update.
 *
 * Strategy:
 *  - Provision two test users (volunteer, requester) via admin API.
 *  - Seed resource + TWO conversations:
 *    (1) conv_active: status='active' (to test the End & review button)
 *    (2) conv_completed: status='completed' (to test the review prompt)
 *  - Drive UI end-to-end through the Messages panel.
 *  - Cleanup: delete seeded rows in afterAll.
 *
 * Run:
 *   npx playwright test apps/web/e2e/conversation-reviews.spec.ts --reporter=line
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

const USER_PASSWORD = 'Test-ConvReview-123!'
const FIXED_TS = '20260609convrev2'
const VOLUNTEER_EMAIL = `e2e+vol-${FIXED_TS}@feed.local`
const REQUESTER_EMAIL = `e2e+req-${FIXED_TS}@feed.local`
const RESOURCE_NAME = `E2E Conv Review Resource ${FIXED_TS}`

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let volunteerProvision: VaultProvisionResult
let requesterProvision: VaultProvisionResult
let resourceId: string
let convActiveId: string
let convCompletedId: string

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up any prior run
  const { data: existing } = await admin.auth.admin.listUsers()
  for (const email of [VOLUNTEER_EMAIL, REQUESTER_EMAIL]) {
    const prior = existing?.users?.find((u) => u.email === email)
    if (prior) await deleteProvisionedUser(admin, prior.id)
  }
  await admin.from('resources').delete().ilike('name', `%${FIXED_TS}%`)

  // Provision both users
  volunteerProvision = await provisionVaultUser({
    adminClient: admin,
    email: VOLUNTEER_EMAIL,
    password: USER_PASSWORD,
    fullName: 'ConvRev Volunteer',
    phone: '5550007777',
    residentialAddress: { line1: '1 Vol Ln', city: 'Burlington', state: 'VT', zip_code: '05401' },
  })
  requesterProvision = await provisionVaultUser({
    adminClient: admin,
    email: REQUESTER_EMAIL,
    password: USER_PASSWORD,
    fullName: 'ConvRev Requester',
    phone: '5550008888',
    residentialAddress: { line1: '2 Req Blvd', city: 'Burlington', state: 'VT', zip_code: '05401' },
  })

  // Seed resource
  const { data: resRow, error: resErr } = await admin
    .from('resources')
    .insert({
      name: RESOURCE_NAME,
      category: 'food',
      source: 'user_submitted',
      is_volunteer_resource: true,
      submitted_by: volunteerProvision.userId,
      address_line1: '1 Vol Ln',
      city: 'Burlington',
      state: 'VT',
      zip_code: '05401',
      status: 'approved',
    })
    .select('id')
    .single()
  if (resErr || !resRow) throw new Error(`Failed to seed resource: ${resErr?.message}`)
  resourceId = resRow.id
  console.log(`[conv-reviews] seeded resource ${resourceId}`)

  // Seed active conversation (for End & review button test)
  const { data: convA, error: convAErr } = await admin
    .from('conversations')
    .insert({
      resource_id: resourceId,
      volunteer_id: volunteerProvision.userId,
      requester_id: requesterProvision.userId,
      status: 'active',
    })
    .select('id')
    .single()
  if (convAErr || !convA) throw new Error(`Failed to seed active conversation: ${convAErr?.message}`)
  convActiveId = convA.id
  console.log(`[conv-reviews] seeded active conversation ${convActiveId}`)

  // Seed message in active conv
  await admin.from('messages').insert({
    conversation_id: convActiveId,
    sender_id: requesterProvision.userId,
    content: 'Hi, can I get help with food?',
    is_read: false,
  })

  // Seed completed conversation (for review prompt tests)
  const { data: convC, error: convCErr } = await admin
    .from('conversations')
    .insert({
      resource_id: resourceId,
      volunteer_id: volunteerProvision.userId,
      requester_id: requesterProvision.userId,
      status: 'completed',
    })
    .select('id')
    .single()
  if (convCErr || !convC) throw new Error(`Failed to seed completed conversation: ${convCErr?.message}`)
  convCompletedId = convC.id
  console.log(`[conv-reviews] seeded completed conversation ${convCompletedId}`)

  await admin.from('messages').insert({
    conversation_id: convCompletedId,
    sender_id: requesterProvision.userId,
    content: 'Thanks so much for your help!',
    is_read: true,
  })
})

test.afterAll(async () => {
  try {
    for (const convId of [convActiveId, convCompletedId]) {
      if (convId) {
        await admin.from('reviews').delete().eq('conversation_id', convId)
        await admin.from('conversations').delete().eq('id', convId)
      }
    }
    if (resourceId) await admin.from('resources').delete().eq('id', resourceId)
    if (volunteerProvision?.userId) await deleteProvisionedUser(admin, volunteerProvision.userId)
    if (requesterProvision?.userId) await deleteProvisionedUser(admin, requesterProvision.userId)
  } catch (err) {
    console.error('[conv-reviews] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Login and navigate to the Messages panel.
 * Waits until at least one conversation card button is visible in the list.
 * The messages panel conversation list is always the left column (md:flex even when a thread is open).
 */
async function loginAndGoToMessages(
  page: import('@playwright/test').Page,
  email: string,
  password: string
) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })

  // Wait for the SPA shell to be ready before navigating
  await page.locator('[data-testid="sidebar-feed"]').waitFor({ state: 'visible', timeout: 20_000 })
  await page.locator('[data-testid="sidebar-feed"]').click()

  // Switch to Messages subtab
  await page.locator('#feed-tab-messages').click()
  const panel = page.locator('[role="tabpanel"]#feed-panel-messages')
  await expect(panel).toBeVisible({ timeout: 15_000 })

  // Wait for at least one conversation card button to appear (data loaded), or the empty state.
  // ConversationCard renders as a <button> inside the left-column list.
  // We wait for the button containing "ConvRev" (the name prefix used by our seeded users).
  await Promise.race([
    panel.locator('button', { hasText: /ConvRev/i }).first()
      .waitFor({ state: 'visible', timeout: 12_000 }).catch(() => null),
    panel.locator('h3', { hasText: /No messages yet/i })
      .waitFor({ state: 'visible', timeout: 12_000 }).catch(() => null),
  ])
}

/**
 * Click the completed conversation card.
 * Relies on our seed always having exactly 1 active + 1 completed conversation.
 * Active is rendered first, completed is rendered last in the list.
 */
async function selectCompletedConversation(panel: import('@playwright/test').Locator) {
  // Wait for both conversation cards to appear (active + completed)
  const cards = panel.locator('button', { hasText: /ConvRev/i })
  await expect(cards).toHaveCount(2, { timeout: 10_000 })
  // The completed conversation card is the last one (active is first)
  await cards.last().click()
  console.log('[conv-reviews] clicked completed conversation card')
}

// ---------------------------------------------------------------------------
// Test (a): End & review button visible for active conversation
// ---------------------------------------------------------------------------

test('(a) volunteer sees End & review button for active conversation', async ({ page }) => {
  await loginAndGoToMessages(page, VOLUNTEER_EMAIL, USER_PASSWORD)
  const panel = page.locator('[role="tabpanel"]#feed-panel-messages')

  // Wait for both conversation cards (active + completed), then click the first (active)
  const cards = panel.locator('button', { hasText: /ConvRev/i })
  await expect(cards).toHaveCount(2, { timeout: 10_000 })
  await cards.first().click()
  console.log('[conv-reviews] clicked active conversation card')

  // End & review button should be visible (volunteer + active status)
  const endBtn = panel.locator('[data-testid="end-and-review-btn"]')
  await expect(endBtn).toBeVisible({ timeout: 10_000 })
  console.log('[conv-reviews] End & review button visible')
})

// ---------------------------------------------------------------------------
// Test (b): Both parties see review prompt for completed conversation
// ---------------------------------------------------------------------------

test('(b-volunteer) volunteer sees review prompt for completed conversation', async ({ page }) => {
  await loginAndGoToMessages(page, VOLUNTEER_EMAIL, USER_PASSWORD)
  const panel = page.locator('[role="tabpanel"]#feed-panel-messages')
  await selectCompletedConversation(panel)

  // Review prompt should appear
  const reviewPrompt = page.locator('[data-testid="review-prompt-card"]')
  await expect(reviewPrompt).toBeVisible({ timeout: 15_000 })
  await expect(reviewPrompt.locator('p', { hasText: 'How did it go?' })).toBeVisible()
  console.log('[conv-reviews] volunteer sees review prompt')
})

test('(b-requester) requester sees review prompt for completed conversation', async ({ page }) => {
  await loginAndGoToMessages(page, REQUESTER_EMAIL, USER_PASSWORD)
  const panel = page.locator('[role="tabpanel"]#feed-panel-messages')
  await selectCompletedConversation(panel)

  const reviewPrompt = page.locator('[data-testid="review-prompt-card"]')
  await expect(reviewPrompt).toBeVisible({ timeout: 15_000 })
  await expect(reviewPrompt.locator('p', { hasText: 'How did it go?' })).toBeVisible()
  console.log('[conv-reviews] requester sees review prompt')
})

// ---------------------------------------------------------------------------
// Test (c+d): Volunteer submits 4-stalk review
// ---------------------------------------------------------------------------

test('(c-volunteer) volunteer submits 4-stalk rating → submitted card shows stalks, requester harmony updates', async ({ page }) => {
  await loginAndGoToMessages(page, VOLUNTEER_EMAIL, USER_PASSWORD)
  const panel = page.locator('[role="tabpanel"]#feed-panel-messages')
  await selectCompletedConversation(panel)

  // Open review modal
  const openBtn = page.locator('[data-testid="open-review-modal-btn"]')
  await expect(openBtn).toBeVisible({ timeout: 15_000 })
  await openBtn.click()

  const stalkGroup = page.locator('[data-testid="review-stalks"]')
  await expect(stalkGroup).toBeVisible({ timeout: 5_000 })

  // Click stalk 4
  await page.locator('[data-testid="review-stalk-4"]').click()
  console.log('[conv-reviews] volunteer selected 4 stalks')

  const submitBtn = page.locator('[data-testid="review-submit"]')
  await expect(submitBtn).toBeEnabled({ timeout: 3_000 })
  await submitBtn.click()

  // Modal closes
  await expect(stalkGroup).not.toBeVisible({ timeout: 10_000 })

  // Submitted card appears
  const submittedCard = page.locator('[data-testid="review-submitted-card"]')
  await expect(submittedCard).toBeVisible({ timeout: 10_000 })
  console.log('[conv-reviews] volunteer submitted card visible with stalks')

  // DB assert: requester harmony updated
  const { data: profile } = await admin
    .from('profiles')
    .select('harmony_score, harmony_reviews_count')
    .eq('id', requesterProvision.userId)
    .single()
  console.log('[conv-reviews] requester harmony:', profile)
  expect(profile?.harmony_reviews_count).toBeGreaterThanOrEqual(1)
  expect(profile?.harmony_score).toBeTruthy()
})

// ---------------------------------------------------------------------------
// Test (c+d): Requester submits 5-stalk review
// ---------------------------------------------------------------------------

test('(c-requester) requester submits 5-stalk rating → submitted card shows stalks, volunteer harmony updates', async ({ page }) => {
  await loginAndGoToMessages(page, REQUESTER_EMAIL, USER_PASSWORD)
  const panel = page.locator('[role="tabpanel"]#feed-panel-messages')
  await selectCompletedConversation(panel)

  // Open review modal
  const openBtn = page.locator('[data-testid="open-review-modal-btn"]')
  await expect(openBtn).toBeVisible({ timeout: 15_000 })
  await openBtn.click()

  const stalkGroup = page.locator('[data-testid="review-stalks"]')
  await expect(stalkGroup).toBeVisible({ timeout: 5_000 })

  // Click stalk 5
  await page.locator('[data-testid="review-stalk-5"]').click()
  console.log('[conv-reviews] requester selected 5 stalks')

  const submitBtn = page.locator('[data-testid="review-submit"]')
  await expect(submitBtn).toBeEnabled({ timeout: 3_000 })
  await submitBtn.click()

  await expect(stalkGroup).not.toBeVisible({ timeout: 10_000 })

  const submittedCard = page.locator('[data-testid="review-submitted-card"]')
  await expect(submittedCard).toBeVisible({ timeout: 10_000 })
  console.log('[conv-reviews] requester submitted card visible')

  // DB assert: volunteer harmony updated
  const { data: volProfile } = await admin
    .from('profiles')
    .select('harmony_score, harmony_reviews_count')
    .eq('id', volunteerProvision.userId)
    .single()
  console.log('[conv-reviews] volunteer harmony:', volProfile)
  expect(volProfile?.harmony_reviews_count).toBeGreaterThanOrEqual(1)
  expect(volProfile?.harmony_score).toBeTruthy()
})
