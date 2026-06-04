/**
 * resource-linked-posts.spec.ts — Phase B: resource-linked posts E2E
 *
 * Coverage (5 assertions):
 *  1. Post created with linked resource shows a resource chip on the post card.
 *  2. Resource chip contains the resource name.
 *  3. Opening the resource detail dialog shows the Community Posts section.
 *  4. The linked post appears under Community Posts.
 *  5. Post without a resource has no resource chip.
 *
 * Strategy:
 *  - Provision a test user + a resource row via admin API (no saved_resources needed
 *    for the feed composer test — we insert the post + saved_resource directly via
 *    admin so we can set resource_id deterministically).
 *  - Drive the SPA feed panel to verify the chip renders on a real fetched post.
 *  - Drive the documents panel resource detail to verify Community Posts section.
 *
 * Run:
 *   cd apps/web && npx playwright test e2e/resource-linked-posts.spec.ts --reporter=line
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

const USER_PASSWORD = 'Test-ResourcePost-123!'
const FIXED_TS = '20260604resourcepost'
const TEST_EMAIL = `e2e+resourcepost-${FIXED_TS}@feed.local`
const RESOURCE_NAME = 'E2E Test Food Bank'
const POST_CONTENT = `E2E resource-linked post ${FIXED_TS}`
const POST_CONTENT_NO_RESOURCE = `E2E unlinked post ${FIXED_TS}`

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let provision: VaultProvisionResult
let resourceId: string
let linkedPostId: string
let unlinkedPostId: string
let savedResourceId: string

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

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
    fullName: 'ResourcePost Test User',
    phone: '5550009999',
    residentialAddress: {
      line1: '9 Resource Ln',
      city: 'Austin',
      state: 'TX',
      zip_code: '73399',
    },
  })

  const userId = provision.userId

  // Insert a resource row directly (admin client, service role bypasses RLS)
  const { data: resourceRow, error: resourceErr } = await (admin as any)
    .from('resources')
    .insert({
      name: RESOURCE_NAME,
      description: 'E2E test resource for resource-linked-posts spec',
      category: 'food',
      submitted_by: userId,
      status: 'approved',
      is_verified: true,
    })
    .select('id')
    .single()

  if (resourceErr || !resourceRow) {
    throw new Error(`Failed to insert resource: ${resourceErr?.message}`)
  }
  resourceId = resourceRow.id
  console.log(`[resource-linked-posts] resource created: ${resourceId}`)

  // Insert a post linked to the resource
  const { data: linkedPost, error: linkedPostErr } = await (admin as any)
    .from('posts')
    .insert({
      user_id: userId,
      content: POST_CONTENT,
      resource_id: resourceId,
    })
    .select('id')
    .single()

  if (linkedPostErr || !linkedPost) {
    throw new Error(`Failed to insert linked post: ${linkedPostErr?.message}`)
  }
  linkedPostId = linkedPost.id
  console.log(`[resource-linked-posts] linked post created: ${linkedPostId}`)

  // Insert a post with NO resource link
  const { data: unlinkedPost, error: unlinkedPostErr } = await (admin as any)
    .from('posts')
    .insert({
      user_id: userId,
      content: POST_CONTENT_NO_RESOURCE,
    })
    .select('id')
    .single()

  if (unlinkedPostErr || !unlinkedPost) {
    throw new Error(`Failed to insert unlinked post: ${unlinkedPostErr?.message}`)
  }
  unlinkedPostId = unlinkedPost.id
  console.log(`[resource-linked-posts] unlinked post created: ${unlinkedPostId}`)

  // Insert a saved_resource row so the resource detail dialog is accessible
  const { data: savedRow, error: savedErr } = await (admin as any)
    .from('saved_resources')
    .insert({
      user_id: userId,
      resource_id: resourceId,
      resource_name: RESOURCE_NAME,
      resource_category: 'food',
    })
    .select('id')
    .single()

  if (savedErr || !savedRow) {
    throw new Error(`Failed to insert saved_resource: ${savedErr?.message}`)
  }
  savedResourceId = savedRow.id
  console.log(`[resource-linked-posts] saved_resource created: ${savedResourceId}`)
})

test.afterAll(async () => {
  try {
    // Clean up posts, resource, saved_resource, then user
    if (linkedPostId) await (admin as any).from('posts').delete().eq('id', linkedPostId)
    if (unlinkedPostId) await (admin as any).from('posts').delete().eq('id', unlinkedPostId)
    if (savedResourceId) await (admin as any).from('saved_resources').delete().eq('id', savedResourceId)
    if (resourceId) await (admin as any).from('resources').delete().eq('id', resourceId)
    if (provision?.userId) {
      await deleteProvisionedUser(admin, provision.userId)
      console.log(`[resource-linked-posts] deleted test user ${provision.userId}`)
    }
  } catch (err) {
    console.error('[resource-linked-posts] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAndNavigateToFeed(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', TEST_EMAIL)
  await page.fill('#password', USER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })
  // Navigate to Feed panel via sidebar
  await page.locator('[data-testid="sidebar-feed"]').click()
  // Wait for the feed tab panel to be visible
  await expect(page.locator('[role="tabpanel"]#feed-panel-feed')).toBeVisible({ timeout: 15_000 })
  console.log('[resource-linked-posts] Feed panel active')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('linked post shows resource chip with resource name', async ({ page }) => {
  await loginAndNavigateToFeed(page)

  // Wait for the post card with the linked post to appear
  const postCard = page.locator(`[data-testid="post-${linkedPostId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })
  console.log('[resource-linked-posts] linked post card visible')

  // Assertion 1: resource chip is present
  const chip = postCard.locator(`[data-testid="resource-chip-${linkedPostId}"]`)
  await expect(chip).toBeVisible({ timeout: 5_000 })
  console.log('[resource-linked-posts] resource chip visible')

  // Assertion 2: chip contains the resource name
  await expect(chip).toContainText(RESOURCE_NAME)
  console.log('[resource-linked-posts] resource chip contains resource name')
})

test('unlinked post has no resource chip', async ({ page }) => {
  await loginAndNavigateToFeed(page)

  const postCard = page.locator(`[data-testid="post-${unlinkedPostId}"]`)
  await expect(postCard).toBeVisible({ timeout: 15_000 })

  // Assertion 3: no chip on the unlinked post
  const chip = postCard.locator(`[data-testid="resource-chip-${unlinkedPostId}"]`)
  await expect(chip).not.toBeVisible()
  console.log('[resource-linked-posts] unlinked post has no resource chip')
})

test('resource detail dialog shows Community Posts section with linked post', async ({ page }) => {
  await loginAndNavigateToFeed(page)

  // Navigate to Documents panel (sidebar-documents)
  await page.locator('[data-testid="sidebar-documents"]').click()

  // Click the "My Resources" subtab inside the documents panel
  const resourcesTab = page.locator('[data-testid="docs-tab-resources"]')
  await expect(resourcesTab).toBeVisible({ timeout: 10_000 })
  await resourcesTab.click()
  console.log('[resource-linked-posts] Resources subtab active')

  // Expand the Food category accordion (resource was inserted with category='food')
  // CATEGORY_DISPLAY maps 'food' to display label; check what the accordion shows
  const foodAccordion = page.locator('button').filter({ hasText: /food/i }).first()
  await expect(foodAccordion).toBeVisible({ timeout: 10_000 })
  await foodAccordion.click()
  console.log('[resource-linked-posts] Food category expanded')

  // Click the saved resource row to open the detail dialog
  const resourceRow = page.locator(`[data-testid="saved-resource-${savedResourceId}"]`)
  await expect(resourceRow).toBeVisible({ timeout: 10_000 })
  await resourceRow.click()
  console.log('[resource-linked-posts] Resource row clicked, dialog opening')

  // Wait for the ResourceDetailDialog to open — use the DialogTitle text to disambiguate
  // from the Next.js error overlay which also uses role="dialog"
  const dialog = page.locator('[role="dialog"]').filter({ hasText: RESOURCE_NAME })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // Assertion 4: Community Posts section is present
  const postsSection = dialog.locator('[data-testid="resource-posts-section"]')
  await expect(postsSection).toBeVisible({ timeout: 10_000 })
  console.log('[resource-linked-posts] Community Posts section visible')

  // Assertion 5: the linked post appears in the list
  const linkedPostItem = postsSection.locator(`[data-testid="resource-post-${linkedPostId}"]`)
  await expect(linkedPostItem).toBeVisible({ timeout: 10_000 })
  await expect(linkedPostItem).toContainText(POST_CONTENT)
  console.log('[resource-linked-posts] linked post appears in Community Posts section')
})
