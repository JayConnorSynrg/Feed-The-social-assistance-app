/**
 * programs-posts-bridge.spec.ts — P9-T1 remainder: Share to Feed + Application back-link
 *
 * Coverage (2 scenarios):
 *  (a) Share to Feed: clicking "Share to Feed" on a program card opens the share
 *      dialog, editing the text and submitting creates a post that appears in the
 *      feed with the resource chip (data-testid resource-chip-<postId>).
 *  (b) Application back-link: clicking the tappable program-name on an application
 *      card navigates to the documents panel on the forms subtab.
 *
 * Strategy:
 *  - Provision one test user with confirmed email via admin API.
 *  - For (a): use an existing production VT/food resource (look up first ID from DB)
 *    so no seeding race condition. Navigate to programs panel, select VT, expand a
 *    card, click Share, submit, assert resource-chip in feed.
 *  - For (b): seed one form_submission (SNAP) via admin client, click the tappable
 *    program-name back-link, assert documents panel opens on forms subtab.
 *  - afterAll: delete test posts (by unique content marker) and the test user.
 *    No test posts leak into the live feed pool.
 *
 * Run:
 *   cd /Users/jelalconnor/CODING/CURSOR/FEED. && npx playwright test apps/web/e2e/programs-posts-bridge.spec.ts --reporter=line
 */

import { test, expect, type Page } from '@playwright/test'
import { type SupabaseClient } from '@supabase/supabase-js'
import {
  makeAdminClient,
  deleteProvisionedUser,
} from './helpers/vault-fixture'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FIXED_TS = `20260610ppbridge`
const USER_EMAIL = `e2e+ppbridge-${FIXED_TS}@feed.local`
const USER_PASSWORD = 'PpBridge-12!'
/** Unique marker embedded in every test post so afterAll can sweep them */
const POST_MARKER = `e2e-ppbridge-${FIXED_TS}`

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state
// ─────────────────────────────────────────────────────────────────────────────

let admin: SupabaseClient
let userId: string
let submissionId: string
/** ID of an existing production VT food resource, looked up in beforeAll */
let existingResourceId: string

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function loginAndGoToRoot(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', USER_EMAIL)
  await page.fill('#password', USER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Clean up any prior run's test user
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing?.users?.find((u) => u.email === USER_EMAIL)
  if (prior) await deleteProvisionedUser(admin, prior.id)

  // 1. Create test user
  const { data: userData, error: createErr } = await admin.auth.admin.createUser({
    email: USER_EMAIL,
    password: USER_PASSWORD,
    email_confirm: true,
  })
  if (createErr || !userData.user) throw new Error(`Create user failed: ${createErr?.message}`)
  userId = userData.user.id

  // Update the profile created by the handle_new_user trigger
  const { error: profileErr } = await admin
    .from('profiles')
    .update({
      username: `ppbridge-${FIXED_TS}`,
      full_name: 'E2E Bridge User',
      user_role: 'seeking',
      onboarding_completed: true,
    })
    .eq('id', userId)
  if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`)

  // 2. Look up an existing VT food approved admin_added non-volunteer resource.
  //    The programs hook filters on source='admin_added' AND is_volunteer_resource=false,
  //    so we must match those same constraints to find a card that will appear in the UI.
  const { data: vtResource, error: resourceLookupErr } = await admin
    .from('resources')
    .select('id')
    .eq('state', 'VT')
    .eq('category', 'food')
    .eq('status', 'approved')
    .eq('source', 'admin_added')
    .eq('is_volunteer_resource', false)
    .limit(1)
    .single()
  if (resourceLookupErr || !vtResource) throw new Error(`No VT food admin_added approved resource found: ${resourceLookupErr?.message}`)
  existingResourceId = vtResource.id

  // 3. Seed a form_submission (application) linked to the SNAP template
  const { data: sub, error: subErr } = await admin
    .from('form_submissions')
    .insert({
      user_id: userId,
      template_id: 'snap-application-v1',
      status: 'submitted',
    })
    .select('id')
    .single()
  if (subErr || !sub) throw new Error(`Seed form_submission failed: ${subErr?.message}`)
  submissionId = sub.id
})

// ─────────────────────────────────────────────────────────────────────────────
// Teardown
// ─────────────────────────────────────────────────────────────────────────────

test.afterAll(async () => {
  // Delete test posts by unique content marker — sweeps any posts from this run
  await admin.from('posts').delete().like('content', `%${POST_MARKER}%`)

  // Delete seeded application
  if (submissionId) {
    await admin.from('form_submissions').delete().eq('id', submissionId)
  }

  // Delete test user (cascades profile)
  if (userId) await deleteProvisionedUser(admin, userId)
})

// ─────────────────────────────────────────────────────────────────────────────
// Test (a): Share to Feed creates a post with resource chip in the feed
// ─────────────────────────────────────────────────────────────────────────────

test('(a) Share to Feed: program card → dialog → post appears in feed with resource chip', async ({ page }) => {
  await loginAndGoToRoot(page)

  // Navigate to programs panel
  await page.locator('[data-testid="sidebar-programs"]').click()
  // Wait for the state selector to appear
  const stateSelect = page.locator('select').filter({ has: page.locator('option[disabled]') })
  await expect(stateSelect).toBeVisible({ timeout: 15_000 })

  // Select VT to load programs
  await stateSelect.selectOption({ value: 'VT' })

  // Wait for any program card to load (confirms the state filter worked)
  await expect(page.locator('[data-testid^="program-card-"]').first()).toBeVisible({ timeout: 20_000 })

  // Find the specific existing VT resource card
  const programCard = page.locator(`[data-testid="program-card-${existingResourceId}"]`)
  await expect(programCard).toBeVisible({ timeout: 15_000 })

  // Expand the card to reveal action buttons
  await programCard.click()

  // Click "Share to Feed"
  const shareBtn = page.locator(`[data-testid="share-to-feed-btn-${existingResourceId}"]`)
  await expect(shareBtn).toBeVisible({ timeout: 5_000 })
  await shareBtn.click()

  // Dialog should open
  await expect(page.locator('[data-testid="share-to-feed-dialog"]')).toBeVisible({ timeout: 5_000 })

  // Clear textarea and type a unique post content with the marker
  const textarea = page.locator('[data-testid="share-content-input"]')
  await textarea.clear()
  const postContent = `${POST_MARKER} — sharing program to community feed`
  await textarea.fill(postContent)

  // Submit
  const submitBtn = page.locator('[data-testid="share-to-feed-submit"]')
  await expect(submitBtn).not.toBeDisabled()
  await submitBtn.click()

  // After successful share, navigates to feed panel
  await expect(page.locator('[role="tabpanel"]#feed-panel-feed')).toBeVisible({ timeout: 15_000 })

  // Reload to guarantee a fresh fetchPosts() after the insert is committed.
  // setActivePanel('feed') pushes #feed to window.location.hash, so the hash
  // persists through the reload and the shell re-initializes to the feed panel.
  await page.reload()
  await page.waitForURL(/\/#feed/, { timeout: 15_000 })

  // Wait for the feed tabpanel to appear and the loading spinner to clear
  await expect(page.locator('[role="tabpanel"]#feed-panel-feed')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[role="tabpanel"]#feed-panel-feed .animate-spin')).toBeHidden({ timeout: 15_000 })

  // Find the post wrapper with our unique marker text.
  // The feed renders each post as <div data-testid="post-<id>"> wrapping a <PostCard>.
  const postWrapper = page.locator('[data-testid^="post-"]').filter({ hasText: POST_MARKER })
  await expect(postWrapper).toBeVisible({ timeout: 15_000 })

  // Derive post ID from data-testid (strip the "post-" prefix)
  const testId = await postWrapper.getAttribute('data-testid')
  const postId = testId?.replace('post-', '')
  expect(postId).toBeTruthy()

  // The resource chip must be visible on the post (data-testid="resource-chip-<postId>")
  const resourceChip = page.locator(`[data-testid="resource-chip-${postId}"]`)
  await expect(resourceChip).toBeVisible({ timeout: 10_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// Test (b): Application program-name link → documents panel forms subtab
// ─────────────────────────────────────────────────────────────────────────────

test('(b) Application form back-link: clicking program name navigates to documents/forms', async ({ page }) => {
  await loginAndGoToRoot(page)

  // Navigate to applications panel
  await page.locator('[data-testid="sidebar-applications"]').click()

  // The SNAP application we seeded has form_type='snap' from the form_templates join.
  // Its card shows the program-name as a tappable link with data-testid="app-form-link-<submissionId>"
  const ourAppLink = page.locator(`[data-testid="app-form-link-${submissionId}"]`)
  await expect(ourAppLink).toBeVisible({ timeout: 15_000 })

  // Click the back-link
  await ourAppLink.click()

  // Should land on documents panel with the forms subtab active.
  // documents-panel renders data-testid="docs-tab-forms" with aria-selected="true" when forms is active.
  const formsTab = page.locator('[data-testid="docs-tab-forms"]')
  await expect(formsTab).toBeVisible({ timeout: 15_000 })
  await expect(formsTab).toHaveAttribute('aria-selected', 'true')

  // Confirm we are NOT on the feed panel
  await expect(page.locator('[role="tabpanel"]#feed-panel-feed')).not.toBeVisible()
})
