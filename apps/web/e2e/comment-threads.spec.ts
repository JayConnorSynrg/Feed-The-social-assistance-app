/**
 * comment-threads.spec.ts — Phase A: Comment Threads E2E
 *
 * Verifies the end-to-end user flow for comment threads:
 *   1. Open a post's thread (click Comment button)
 *   2. Submit a top-level comment
 *   3. Comment appears in the DOM
 *   4. Reply to a comment → nested reply appears
 *   5. Thread closes on second click (toggle)
 *
 * Setup:
 *   - Provisions a test user via admin API (vault-fixture pattern)
 *   - Seeds one post for the test user
 *   - Cleans up user + post in afterAll
 *
 * Run:
 *   npx playwright test apps/web/e2e/comment-threads.spec.ts --reporter=line
 */

import { test, expect, type Page } from '@playwright/test'
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

const USER_PASSWORD = 'Test-CommentThread-123!'
const FIXED_TS = '20260604commentthreads'
const TEST_EMAIL = `e2e+commentthread-${FIXED_TS}@feed.local`
const TEST_TIMEOUT_MS = 60_000

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let provision: VaultProvisionResult
let seededPostId: string

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up any leftover from a prior run
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (prior) {
    await deleteProvisionedUser(admin, prior.id)
  }

  provision = await provisionVaultUser({
    adminClient: admin,
    email: TEST_EMAIL,
    password: USER_PASSWORD,
    fullName: 'CommentThread Test',
    phone: '5550004444',
    residentialAddress: {
      line1: '4 Thread Lane',
      city: 'Austin',
      state: 'TX',
      zip_code: '73301',
    },
  })

  // Seed one post for the test user so there's something to comment on
  const { data: postData, error: postError } = await admin
    .from('posts')
    .insert({
      user_id: provision.userId,
      content: 'E2E test post for comment thread spec',
      is_hidden: false,
      is_pinned: false,
    })
    .select('id')
    .single()

  if (postError || !postData) {
    throw new Error(`Failed to seed post: ${postError?.message}`)
  }
  seededPostId = postData.id
  console.log(`[comment-threads] Seeded post ${seededPostId}`)
})

test.afterAll(async () => {
  try {
    // Delete post (cascades to comments)
    if (seededPostId) {
      await admin.from('posts').delete().eq('id', seededPostId)
    }
    if (provision?.userId) {
      await deleteProvisionedUser(admin, provision.userId)
      console.log(`[comment-threads] Deleted test user ${provision.userId}`)
    }
  } catch (err) {
    console.error('[comment-threads] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Helper: login and navigate to Feed panel
// ---------------------------------------------------------------------------

async function loginAndNavigateToFeed(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', TEST_EMAIL)
  await page.fill('#password', USER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })

  // Navigate to Feed panel via sidebar
  const feedSidebarBtn = page.locator('[data-testid="sidebar-feed"]')
  await feedSidebarBtn.click()

  // Wait for the seeded post to appear
  await expect(
    page.locator(`[data-testid="post-${seededPostId}"]`)
  ).toBeVisible({ timeout: 15_000 })
  console.log(`[comment-threads] Feed visible with seeded post`)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('open comment thread → submit comment → comment appears in DOM', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS)
  await loginAndNavigateToFeed(page)

  // 1. Click the Comment button on the seeded post to open thread
  const postCard = page.locator(`[data-testid="post-${seededPostId}"]`)
  const commentBtn = postCard.locator('button', { hasText: /comment/i }).first()
  await commentBtn.click()
  console.log('[comment-threads] Comment button clicked')

  // 2. Thread should now be visible
  const thread = page.locator('[data-testid="comment-thread"]').first()
  await expect(thread).toBeVisible({ timeout: 5_000 })
  console.log('[comment-threads] CommentThread rendered')

  // 3. Submit a comment via the composer
  const commentInput = thread.locator('[data-testid="comment-input"]')
  await commentInput.fill('Hello from the E2E test!')
  await thread.locator('[data-testid="comment-submit"]').click()
  console.log('[comment-threads] Comment submitted')

  // 4. The submitted comment should appear in the DOM
  await expect(
    thread.getByText('Hello from the E2E test!')
  ).toBeVisible({ timeout: 10_000 })
  console.log('[comment-threads] Comment visible in thread')
})

test('reply to a comment → nested reply appears', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS)
  await loginAndNavigateToFeed(page)

  // Open thread (may already have comments from prior test run — that is fine)
  const postCard = page.locator(`[data-testid="post-${seededPostId}"]`)
  const commentBtn = postCard.locator('button', { hasText: /comment/i }).first()
  await commentBtn.click()

  const thread = page.locator('[data-testid="comment-thread"]').first()
  await expect(thread).toBeVisible({ timeout: 5_000 })

  // Ensure there's at least one comment to reply to (seed one if needed)
  const input = thread.locator('[data-testid="comment-input"]')
  await input.fill('Parent comment for reply test')
  await thread.locator('[data-testid="comment-submit"]').click()

  // Wait for the parent comment to appear and grab its ID from data-testid
  const parentCommentLocator = thread.locator('[data-testid^="comment-"]').first()
  await expect(parentCommentLocator).toBeVisible({ timeout: 10_000 })

  const parentTestId = await parentCommentLocator.getAttribute('data-testid')
  const parentId = parentTestId?.replace('comment-', '')
  if (!parentId) throw new Error('Could not extract parent comment id from data-testid')
  console.log(`[comment-threads] Parent comment id: ${parentId}`)

  // Click the Reply button on the parent comment
  const replyBtn = thread.locator(`[data-testid="reply-btn-${parentId}"]`)
  await expect(replyBtn).toBeVisible({ timeout: 5_000 })
  await replyBtn.click()
  console.log('[comment-threads] Reply affordance clicked')

  // Fill and submit the reply
  const replyInput = thread.locator(`[data-testid="reply-input-${parentId}"]`)
  await replyInput.fill('Nested reply from E2E!')
  await thread.locator(`[data-testid="reply-submit-${parentId}"]`).click()
  console.log('[comment-threads] Reply submitted')

  // Nested reply appears in DOM
  await expect(thread.getByText('Nested reply from E2E!')).toBeVisible({ timeout: 10_000 })
  console.log('[comment-threads] Nested reply visible')
})

test('second click on Comment button closes the thread', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS)
  await loginAndNavigateToFeed(page)

  const postCard = page.locator(`[data-testid="post-${seededPostId}"]`)
  const commentBtn = postCard.locator('button', { hasText: /comment/i }).first()

  // Open
  await commentBtn.click()
  const thread = page.locator('[data-testid="comment-thread"]').first()
  await expect(thread).toBeVisible({ timeout: 5_000 })

  // Close (toggle)
  await commentBtn.click()
  await expect(thread).not.toBeVisible({ timeout: 3_000 })
  console.log('[comment-threads] Thread toggled closed')
})
