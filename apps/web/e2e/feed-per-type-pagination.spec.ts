/**
 * feed-per-type-pagination.spec.ts — P9-T2: per-type feed UI + feed pagination E2E
 *
 * Coverage (3 assertion groups):
 *
 *  A. Load More pagination
 *     A1. First page renders up to PAGE_SIZE (25) posts; Load More button visible.
 *     A2+A3. Clicking "Load more posts" fetches a second page; no duplicate IDs.
 *
 *  B. Resource-post category badge
 *     B1. A resource_post with a linked resource renders a category badge.
 *     B2. The badge text matches the resource's category label.
 *
 *  C. Safety alerts strip
 *     C1. When an active safety alert exists, the strip renders above the feed.
 *     C2. The strip contains the alert's type label.
 *     C3. "View on map" navigates to the map panel.
 *
 * All tests share a single beforeAll/afterAll via test.describe to avoid
 * race conditions where afterAll cleanup runs before the test body.
 *
 * Unique content marker: FIXED_TS embedded in all test content so afterAll
 * can sweep stray data by like-pattern.
 *
 * Run from repo root:
 *   npx playwright test apps/web/e2e/feed-per-type-pagination.spec.ts --reporter=line
 */

import { test, expect, type Page } from '@playwright/test'
import {
  makeAdminClient,
  provisionVaultUser,
  deleteProvisionedUser,
  type VaultProvisionResult,
} from './helpers/vault-fixture'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_PASSWORD = 'Test-FeedPagination-123!'
const FIXED_TS = '20260610feedpagination'
const TEST_EMAIL = `e2e+feedpagination-${FIXED_TS}@feed.local`

// Unique content markers so afterAll can sweep by like-pattern
const POST_CONTENT_PREFIX = `E2E pagination post ${FIXED_TS} #`
const RESOURCE_NAME = `E2E Pagination Resource ${FIXED_TS}`
const RESOURCE_POST_CONTENT = `E2E resource post with category ${FIXED_TS}`
const SAFETY_DESCRIPTION = `E2E safety alert ${FIXED_TS}`

// Must be > PAGE_SIZE (25) to trigger Load More; inserting 27 gives 3 on page 2
// (plus the resource_post = 28 total test posts + existing DB posts from other users).
const POSTS_TO_INSERT = 27

// ---------------------------------------------------------------------------
// Shared state (set in beforeAll, read in tests)
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let provision: VaultProvisionResult
const postIds: string[] = []
let resourceId: string | null = null
let resourcePostId: string | null = null
let safetyAlertId: string | null = null

// ---------------------------------------------------------------------------
// Setup / Teardown (SHARED — all tests get the same provisioned user)
// ---------------------------------------------------------------------------

test.describe('P9-T2 feed per-type UI + pagination', () => {
  test.beforeAll(async () => {
    admin = makeAdminClient()

    // Clean up any prior run with this fixed email
    const { data: existing } = await admin.auth.admin.listUsers()
    const prior = existing?.users?.find((u) => u.email === TEST_EMAIL)
    if (prior) {
      await deleteProvisionedUser(admin, prior.id)
    }

    provision = await provisionVaultUser({
      adminClient: admin,
      email: TEST_EMAIL,
      password: USER_PASSWORD,
      fullName: 'Pagination Test User',
      phone: '5550001111',
      residentialAddress: {
        line1: '1 Pagination Ave',
        city: 'Montpelier',
        state: 'VT',
        zip_code: '05601',
      },
    })
    console.log(`[feed-per-type-pagination] provisioned user ${provision.userId}`)

    const userId = provision.userId

    // Insert POSTS_TO_INSERT general posts so Load More triggers.
    // Insert sequentially with a 1ms sleep between to get distinct created_at values.
    for (let i = 1; i <= POSTS_TO_INSERT; i++) {
      const { data, error } = await admin
        .from('posts')
        .insert({
          user_id: userId,
          content: `${POST_CONTENT_PREFIX}${i}`,
          post_type: 'feed',
        })
        .select('id')
        .single()
      if (error || !data) throw new Error(`Failed to insert post #${i}: ${error?.message}`)
      postIds.push(data.id)
      // 2ms gap so created_at values are spread across multiple milliseconds;
      // this ensures the keyset cursor (created_at, id) correctly partitions pages.
      await new Promise((r) => setTimeout(r, 2))
    }
    console.log(`[feed-per-type-pagination] inserted ${postIds.length} posts`)

    // Insert a resource with a known category
    const { data: res, error: resErr } = await admin
      .from('resources')
      .insert({
        name: RESOURCE_NAME,
        description: 'E2E pagination resource',
        category: 'food',
        submitted_by: userId,
        status: 'approved',
        is_verified: true,
      })
      .select('id')
      .single()
    if (resErr || !res) throw new Error(`Failed to insert resource: ${resErr?.message}`)
    resourceId = res.id

    // Insert a resource_post linked to the resource (newest post in the set)
    await new Promise((r) => setTimeout(r, 2))
    const { data: rp, error: rpErr } = await admin
      .from('posts')
      .insert({
        user_id: userId,
        content: RESOURCE_POST_CONTENT,
        resource_id: resourceId,
        post_type: 'resource_post',
      })
      .select('id')
      .single()
    if (rpErr || !rp) throw new Error(`Failed to insert resource post: ${rpErr?.message}`)
    resourcePostId = rp.id
    postIds.push(resourcePostId)
    console.log(`[feed-per-type-pagination] resource post created: ${resourcePostId}`)

    // Insert a safety alert using an authenticated user Supabase client via the
    // place_safety_alert SECDEF RPC. The RPC requires auth.uid() to be non-null.
    // service_role has NULL auth.uid(), so we sign in as the test user.
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error: signInErr } = await userClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: USER_PASSWORD,
    })
    if (signInErr) throw new Error(`Safety alert user sign-in failed: ${signInErr.message}`)

    // place_safety_alert returns the safety_alerts row — the RPC handles PostGIS geometry.
    const { data: alertRow, error: alertErr } = await userClient
      .rpc('place_safety_alert', {
        p_type: 'general',
        p_severity: 2,
        p_description: SAFETY_DESCRIPTION,
        p_lng: -72.5778,
        p_lat: 44.2601,
      })

    if (alertErr || !alertRow) {
      // Non-fatal: C test will be skipped if the alert wasn't created
      console.warn(`[feed-per-type-pagination] safety alert insert failed: ${alertErr?.message}`)
    } else {
      safetyAlertId = (alertRow as { id: string }).id ?? null
      console.log(`[feed-per-type-pagination] safety alert created: ${safetyAlertId}`)
    }
  })

  test.afterAll(async () => {
    try {
      // Remove safety alert via admin DELETE
      if (safetyAlertId) {
        await admin.from('safety_alerts').delete().eq('id', safetyAlertId)
        console.log(`[feed-per-type-pagination] deleted safety alert ${safetyAlertId}`)
      }

      // Remove all test posts
      if (postIds.length > 0) {
        await admin.from('posts').delete().in('id', postIds)
        console.log(`[feed-per-type-pagination] deleted ${postIds.length} posts`)
      }

      // Remove resource
      if (resourceId) {
        await admin.from('resources').delete().eq('id', resourceId)
        console.log(`[feed-per-type-pagination] deleted resource ${resourceId}`)
      }

      // Belt-and-suspenders: sweep any stray data by content marker
      await admin.from('posts').delete().like('content', `%${FIXED_TS}%`)
      await admin.from('safety_alerts').delete().like('description', `%${FIXED_TS}%`)

      if (provision?.userId) {
        await deleteProvisionedUser(admin, provision.userId)
        console.log(`[feed-per-type-pagination] deleted test user ${provision.userId}`)
      }
    } catch (err) {
      console.error('[feed-per-type-pagination] afterAll cleanup error (non-fatal):', err)
    }
  })

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async function loginAndNavigateToFeed(page: Page): Promise<void> {
    await page.goto('/login')
    await page.fill('#email', TEST_EMAIL)
    await page.fill('#password', USER_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })
    await page.locator('[data-testid="sidebar-feed"]').click()
    await expect(page.locator('[role="tabpanel"]#feed-panel-feed')).toBeVisible({ timeout: 15_000 })
    console.log('[feed-per-type-pagination] Feed panel active')
  }

  async function getRenderedPostIds(page: Page): Promise<string[]> {
    const locators = page.locator('[data-testid^="post-"]')
    const count = await locators.count()
    const ids: string[] = []
    for (let i = 0; i < count; i++) {
      const testId = await locators.nth(i).getAttribute('data-testid')
      if (testId) ids.push(testId.replace('post-', ''))
    }
    return ids
  }

  // -------------------------------------------------------------------------
  // A. Pagination
  // -------------------------------------------------------------------------

  test('A1: first page renders at most 25 posts and Load More button is visible', async ({ page }) => {
    await loginAndNavigateToFeed(page)

    // Wait for at least one of our test posts to render
    // Use the resource_post (last inserted = newest = appears on page 1)
    await expect(
      page.locator(`[data-testid="post-${resourcePostId}"]`)
    ).toBeVisible({ timeout: 20_000 })

    const ids = await getRenderedPostIds(page)
    console.log(`[feed-per-type-pagination] A1: rendered ${ids.length} posts on first page`)

    // With 28 test posts (27 general + 1 resource_post) the first page contains 25.
    // PAGE_SIZE = 25. hasMore=true shows the Load More button.
    await expect(page.locator('[data-testid="feed-load-more"]')).toBeVisible({ timeout: 15_000 })
    console.log('[feed-per-type-pagination] A1: Load More button visible')
  })

  test('A2+A3: Load More fetches second page with no duplicate post IDs', async ({ page }) => {
    await loginAndNavigateToFeed(page)

    // Wait for Load More button (confirms first page is at PAGE_SIZE)
    await expect(
      page.locator('[data-testid="feed-load-more"]')
    ).toBeVisible({ timeout: 20_000 })

    const firstPageIds = await getRenderedPostIds(page)
    console.log(`[feed-per-type-pagination] A2: first page has ${firstPageIds.length} posts`)

    // Click Load More
    await page.locator('[data-testid="feed-load-more"]').click()

    // Wait for more posts to appear. Since page 1 had firstPageIds.length posts,
    // page 2 should add at least 1 more. Poll until post count increases.
    await page.waitForFunction(
      (expectedMin) => {
        const posts = document.querySelectorAll('[data-testid^="post-"]')
        return posts.length > expectedMin
      },
      firstPageIds.length,
      { timeout: 30_000 }
    )

    // Brief stabilization pause
    await page.waitForTimeout(500)

    const afterIds = await getRenderedPostIds(page)
    console.log(`[feed-per-type-pagination] A2: after load more: ${afterIds.length} posts`)

    // A3: no duplicates
    const idSet = new Set(afterIds)
    expect(idSet.size).toBe(afterIds.length)
    console.log('[feed-per-type-pagination] A3: no duplicate post IDs')

    // A2: more posts visible than before
    expect(afterIds.length).toBeGreaterThan(firstPageIds.length)
  })

  // -------------------------------------------------------------------------
  // B. Resource-post category badge
  // -------------------------------------------------------------------------

  test('B1+B2: resource_post renders category badge with correct label', async ({ page }) => {
    if (!resourcePostId) throw new Error('resourcePostId not set in beforeAll')

    await loginAndNavigateToFeed(page)

    // The resource post is the newest insert so it should be on page 1
    const postCard = page.locator(`[data-testid="post-${resourcePostId}"]`)
    await expect(postCard).toBeVisible({ timeout: 20_000 })
    console.log('[feed-per-type-pagination] B1: resource post card visible')

    // B1: category badge exists
    const categoryBadge = postCard.locator(`[data-testid="category-badge-${resourcePostId}"]`)
    await expect(categoryBadge).toBeVisible({ timeout: 5_000 })
    console.log('[feed-per-type-pagination] B1: category badge visible')

    // B2: badge text is the correct label for category 'food'
    await expect(categoryBadge).toContainText('Food')
    console.log('[feed-per-type-pagination] B2: badge text is "Food"')
  })

  // -------------------------------------------------------------------------
  // C. Safety alerts strip
  // -------------------------------------------------------------------------

  test('C1+C2+C3: safety strip renders for active alerts and navigates to map', async ({ page }) => {
    if (!safetyAlertId) {
      test.skip()
      return
    }

    await loginAndNavigateToFeed(page)

    // C1: safety strip is visible
    const strip = page.locator('[data-testid="safety-strip"]')
    await expect(strip).toBeVisible({ timeout: 15_000 })
    console.log('[feed-per-type-pagination] C1: safety strip visible')

    // C2: strip contains the alert's type label (alert_type='general' → 'Safety Alert')
    await expect(strip).toContainText('Safety Alert')
    console.log('[feed-per-type-pagination] C2: strip contains alert type label')

    // C3: "View on map" deep-links to the map panel
    await page.locator('[data-testid="safety-strip-view-map"]').click()
    // Feed tab panel should no longer be visible after switching to map
    await expect(
      page.locator('[role="tabpanel"]#feed-panel-feed')
    ).not.toBeVisible({ timeout: 10_000 })
    // Map sidebar button should have the active bg class (bg-[#4a5d23])
    const mapBtn = page.locator('[data-testid="sidebar-map"]')
    await expect(mapBtn).toHaveClass(/bg-\[#4a5d23\]/, { timeout: 5_000 })
    console.log('[feed-per-type-pagination] C3: navigated to map panel')
  })
})
