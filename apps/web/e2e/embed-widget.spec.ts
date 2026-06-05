/**
 * embed-widget.spec.ts — Phase C.5: Public Embeddable Opt-In Widget E2E
 *
 * Coverage (3 scenarios):
 *  a. /s/embed/<id> renders embed-widget + embed-slot-count with live count +
 *     embed-opt-in-btn pointing to the FEED app.
 *  b. When slots_remaining <= 0 the widget shows embed-full and no active opt-in.
 *  c. Header assertion: /s/embed/<id> CSP contains `frame-ancestors *` and has no
 *     x-frame-options: DENY, while a normal route (/) returns x-frame-options: DENY.
 *
 * Strategy:
 *  - Seed one post with max_seekers=2, slots_remaining=1 via admin client.
 *  - The embed route is public SSR (no auth required after proxy fix); tests hit
 *    the real Next.js dev server, which reads from Supabase via anon key.
 *  - Test (b) updates the seeded post to slots_remaining=0 via admin to simulate full.
 *  - Test (c) uses Playwright `request` to assert response headers directly.
 *  - Tear down seeded post in afterAll.
 *
 * Run:
 *   cd apps/web && npx playwright test e2e/embed-widget.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test'
import { makeAdminClient } from './helpers/vault-fixture'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXED_TS = '20260604embedwidget'
const POST_CONTENT = `E2E embed widget test ${FIXED_TS}`

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let postId: string

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // Seed one post. Reuse any existing profile as the user_id (lightweight —
  // no need to provision a full vault user for this read-only embed spec).
  const { data: anyProfile } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .single()

  const userId = anyProfile?.id
  if (!userId) throw new Error('[embed-widget] No profile found for seeding — run auth.spec.ts first')

  // Clean up any prior run with this fixed content
  await admin.from('posts').delete().eq('content', POST_CONTENT)

  const { data: postRow, error: postErr } = await admin
    .from('posts')
    .insert({
      user_id: userId,
      content: POST_CONTENT,
      max_seekers: 2,
      slots_remaining: 1,
      is_hidden: false,
    })
    .select('id')
    .single()

  if (postErr || !postRow) {
    throw new Error(`[embed-widget] Failed to seed post: ${postErr?.message}`)
  }
  postId = postRow.id
  console.log(`[embed-widget] seeded post ${postId}`)
})

test.afterAll(async () => {
  try {
    if (postId) {
      await admin.from('posts').delete().eq('id', postId)
    }
  } catch (err) {
    console.error('[embed-widget] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('(a) embed route renders widget with slot count and opt-in link', async ({ page }) => {
  // The embed route is public SSR — no auth required (proxy publicRoutes includes /s/embed)
  await page.goto(`/s/embed/${postId}`)

  // Widget root
  const widget = page.locator('[data-testid="embed-widget"]')
  await expect(widget).toBeVisible({ timeout: 15_000 })

  // Slot count: 1 of 2 spots left
  const slotCount = page.locator('[data-testid="embed-slot-count"]')
  await expect(slotCount).toBeVisible({ timeout: 5_000 })
  await expect(slotCount).toContainText(/1 of 2/)

  // Opt-in button present and href points to the FEED app root with post param
  const optInBtn = page.locator('[data-testid="embed-opt-in-btn"]')
  await expect(optInBtn).toBeVisible({ timeout: 5_000 })
  const href = await optInBtn.getAttribute('href')
  expect(href).toMatch(/\?post=/)
  expect(href).toContain(postId)

  // target="_top" so it escapes the iframe
  const target = await optInBtn.getAttribute('target')
  expect(target).toBe('_top')

  console.log('[embed-widget] (a) widget + slot count + opt-in button all visible')
})

test('(b) full post shows embed-full state and no active opt-in button', async ({ page }) => {
  // Update post to slots_remaining=0 in DB to simulate fully claimed
  await admin.from('posts').update({ slots_remaining: 0 }).eq('id', postId)

  await page.goto(`/s/embed/${postId}`)

  const widget = page.locator('[data-testid="embed-widget"]')
  await expect(widget).toBeVisible({ timeout: 15_000 })

  // Full state indicator (the span with data-testid="embed-full")
  const fullEl = page.locator('[data-testid="embed-full"]')
  await expect(fullEl).toBeVisible({ timeout: 5_000 })
  await expect(fullEl).toContainText(/Full/i)

  // No active opt-in button
  const optInBtn = page.locator('[data-testid="embed-opt-in-btn"]')
  await expect(optInBtn).not.toBeVisible({ timeout: 3_000 })

  // Restore for cleanup
  await admin.from('posts').update({ slots_remaining: 1 }).eq('id', postId)

  console.log('[embed-widget] (b) full state visible, opt-in absent')
})

test('(c) header assertions: embed route allows framing, normal route denies it', async ({ request }) => {
  // Embed route: frame-ancestors * in CSP, no X-Frame-Options: DENY
  const embedRes = await request.get(`/s/embed/${postId}`)
  const embedCsp = embedRes.headers()['content-security-policy'] ?? ''
  const embedXfo = (embedRes.headers()['x-frame-options'] ?? '').toLowerCase()

  expect(embedCsp).toContain('frame-ancestors *')
  // X-Frame-Options must NOT be DENY on the embed route
  expect(embedXfo).not.toBe('deny')

  console.log(`[embed-widget] (c) embed CSP frame-ancestors: ${embedCsp.match(/frame-ancestors[^;]*/)?.[0] ?? 'not found'}`)
  console.log(`[embed-widget] (c) embed X-Frame-Options: "${embedXfo}"`)

  // Normal route: frame-ancestors 'none' in CSP + X-Frame-Options: DENY
  const normalRes = await request.get('/')
  const normalCsp = normalRes.headers()['content-security-policy'] ?? ''
  const normalXfo = (normalRes.headers()['x-frame-options'] ?? '').toLowerCase()

  expect(normalCsp).toContain("frame-ancestors 'none'")
  expect(normalXfo).toBe('deny')

  console.log(`[embed-widget] (c) normal CSP frame-ancestors: ${normalCsp.match(/frame-ancestors[^;]*/)?.[0] ?? 'not found'}`)
  console.log(`[embed-widget] (c) normal X-Frame-Options: "${normalXfo}"`)
})
