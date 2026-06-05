/**
 * geo-outreach.spec.ts — Phase D2b: Geo Outreach RPC + Composer UI
 *
 * Tests the full geo-outreach layer: seekers_within_radius RPC, the
 * notify_seekers_near_resource fan-out RPC (including dedup guard), and the
 * composer UI toggle + count display + post-submit notification result.
 *
 * Seed strategy (service_role, Management API):
 *   - 1 author user (provisionVaultUser — full SPA login)
 *   - 1 resource with a geo-coded location (Burlington VT area)
 *   - 2 seeker profiles WITHIN 10 mi (lat/lng → trigger derives location)
 *   - 1 seeker profile OUTSIDE 25 mi (Montpelier VT — ~40 mi away)
 *   All seekers: user_role='seeking'; author: user_role='providing'.
 *
 * Run:
 *   pkill -f 'next dev' || true
 *   npx playwright test apps/web/e2e/geo-outreach.spec.ts --reporter=line
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

const FIXED_TS        = `${Date.now()}`
const AUTHOR_EMAIL    = `e2e+geo-author-${FIXED_TS}@feed.local`
const AUTHOR_PASSWORD = 'GeoTest-Author-12!'

const SEEKER_EMAILS = [
  `e2e+geo-seeker1-${FIXED_TS}@feed.local`,     // within 10 mi
  `e2e+geo-seeker2-${FIXED_TS}@feed.local`,     // within 10 mi
  `e2e+geo-seeker3-out-${FIXED_TS}@feed.local`, // ~38 mi out
]

// Burlington VT downtown — resource anchor
const RESOURCE_LAT =  44.4759
const RESOURCE_LNG = -73.2121

// South Burlington — ~4 mi (within 10 mi)
const SEEKER1_LAT =  44.4668
const SEEKER1_LNG = -73.1712

// Williston — ~5 mi (within 10 mi)
const SEEKER2_LAT =  44.4400
const SEEKER2_LNG = -73.0600

// Montpelier VT — ~38 mi (outside 25 mi)
const SEEKER3_LAT =  44.2601
const SEEKER3_LNG = -72.5754

// ---------------------------------------------------------------------------
// Module-level shared state — set once in beforeAll, used across all tests
// ---------------------------------------------------------------------------

let admin: SupabaseClient
let authorProvision: VaultProvisionResult
let resourceId: string
let seekerIds: string[]         // [seeker1-in, seeker2-in, seeker3-out]
let notifyTestPostId: string    // post created for the notify/dedup tests

// ---------------------------------------------------------------------------
// beforeAll — runs ONCE for the entire file
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  admin = makeAdminClient()

  // ── Author ────────────────────────────────────────────────────────────────
  authorProvision = await provisionVaultUser({
    adminClient: admin,
    email: AUTHOR_EMAIL,
    password: AUTHOR_PASSWORD,
    fullName: 'Geo Author',
    phone: '+18005550100',
    residentialAddress: {
      line1: '1 Church St',
      city: 'Burlington',
      state: 'Vermont',
      zip_code: '05401',
    },
  })
  // Author is a provider — NOT included in seeker filter
  await admin.from('profiles').update({ user_role: 'providing' }).eq('id', authorProvision.userId)
  console.log(`[geo-outreach] author: ${authorProvision.userId}`)

  // ── Resource ──────────────────────────────────────────────────────────────
  const { data: rRow, error: rErr } = await admin
    .from('resources')
    .insert({
      name: 'E2E Geo Outreach Resource',
      description: 'Test resource for geo-outreach e2e',
      category: 'food',
      submitted_by: authorProvision.userId,
      status: 'approved',
      is_verified: true,
    })
    .select('id')
    .single()
  if (rErr || !rRow) throw new Error(`resource insert failed: ${rErr?.message}`)
  resourceId = rRow.id
  console.log(`[geo-outreach] resource: ${resourceId}`)

  await admin.rpc('set_resource_location_by_id', { p_id: resourceId, p_lat: RESOURCE_LAT, p_lng: RESOURCE_LNG })
  console.log('[geo-outreach] resource location set')

  // ── Seekers ───────────────────────────────────────────────────────────────
  seekerIds = []
  const coords = [
    { lat: SEEKER1_LAT, lng: SEEKER1_LNG },
    { lat: SEEKER2_LAT, lng: SEEKER2_LNG },
    { lat: SEEKER3_LAT, lng: SEEKER3_LNG },
  ]
  for (let i = 0; i < SEEKER_EMAILS.length; i++) {
    const { data, error } = await admin.auth.admin.createUser({
      email: SEEKER_EMAILS[i],
      password: 'SeekPass-123!',
      email_confirm: true,
    })
    if (error || !data.user) throw new Error(`createUser ${SEEKER_EMAILS[i]}: ${error?.message}`)
    seekerIds.push(data.user.id)
    await admin.from('profiles').upsert(
      { id: data.user.id, full_name: `Geo Seeker ${i + 1}`, onboarding_completed: true, user_role: 'seeking', latitude: coords[i].lat, longitude: coords[i].lng },
      { onConflict: 'id' }
    )
    console.log(`[geo-outreach] seeker ${i + 1}: ${data.user.id}`)
  }

  // ── Post for notify/dedup tests ───────────────────────────────────────────
  const { data: post, error: postErr } = await admin
    .from('posts')
    .insert({ user_id: authorProvision.userId, content: 'E2E geo-outreach notify test', resource_id: resourceId })
    .select('id')
    .single()
  if (postErr || !post) throw new Error(`post insert failed: ${postErr?.message}`)
  notifyTestPostId = post.id
  console.log(`[geo-outreach] notifyTestPostId: ${notifyTestPostId}`)

  // ── saved_resource for composer UI ───────────────────────────────────────
  await admin.from('saved_resources').insert({
    user_id: authorProvision.userId,
    resource_id: resourceId,
    resource_name: 'E2E Geo Outreach Resource',
    resource_category: 'food',
  })
  console.log('[geo-outreach] saved_resource inserted for composer UI test')
})

// ---------------------------------------------------------------------------
// afterAll — runs ONCE for the entire file
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  // Helper: run SQL via Management API (bypasses PostgREST RLS for cleanup)
  const runSql = async (query: string) => {
    const { readFileSync } = await import('fs')
    const envContent = readFileSync('/Users/jelalconnor/CODING/CURSOR/FEED./apps/web/.env.local', 'utf-8')
    const token = envContent.split('\n').find(l => l.startsWith('SUPABASE_ACCESS_TOKEN='))
      ?.replace('SUPABASE_ACCESS_TOKEN=', '').replace(/"/g, '').trim() ?? ''
    await fetch('https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
  }

  try {
    // Notifications — use Management API SQL to bypass PostgREST RLS
    if (notifyTestPostId) {
      await runSql(`DELETE FROM public.notifications WHERE link LIKE '/?post=%';`)
      await admin.from('posts').delete().eq('id', notifyTestPostId)
    }
    // Also clean up UI test posts by author
    if (authorProvision?.userId) {
      const { data: authorPosts } = await admin.from('posts').select('id').eq('user_id', authorProvision.userId)
      for (const p of authorPosts ?? []) {
        await admin.from('posts').delete().eq('id', p.id)
      }
    }
    // saved_resources
    if (resourceId) {
      await admin.from('saved_resources').delete().eq('resource_id', resourceId)
      await admin.from('resources').delete().eq('id', resourceId)
    }
    // Seekers
    for (const sid of seekerIds ?? []) {
      await admin.from('profiles').delete().eq('id', sid)
      await admin.auth.admin.deleteUser(sid)
    }
    // Author
    if (authorProvision?.userId) {
      await deleteProvisionedUser(admin, authorProvision.userId)
    }
  } catch (err) {
    console.error('[geo-outreach] afterAll cleanup error (non-fatal):', err)
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('seekers_within_radius returns in-radius count, excludes out-of-radius and author', async () => {
  // Service_role call: auth.uid() is NULL — the function correctly handles this
  // via (auth.uid() IS NULL OR id <> auth.uid()).
  // Author has user_role='providing' → excluded by seeker filter.
  const { data, error } = await admin.rpc('seekers_within_radius', {
    p_resource_id: resourceId,
    p_radius_miles: 10,
  })

  expect(error).toBeNull()
  expect(typeof data).toBe('number')
  // seeker1 (~4 mi) + seeker2 (~5 mi) are in range; seeker3 (~38 mi) is out.
  expect(data).toBe(2)
  console.log(`[geo-outreach] seekers_within_radius(10mi) = ${data}`)
})

test('RPC response is a bare integer — no coordinate fields', async () => {
  const { data, error } = await admin.rpc('seekers_within_radius', {
    p_resource_id: resourceId,
    p_radius_miles: 25,
  })

  expect(error).toBeNull()
  expect(typeof data).toBe('number')
  // A plain number is never an object — confirms no coordinate/id fields leaked
  expect(typeof data).not.toBe('object')
  console.log(`[geo-outreach] privacy: data type=${typeof data}, value=${data}`)
})

test('notify_seekers_near_resource: first call inserts 2, second call inserts 0 (dedup)', async () => {
  // Call as the post author — RPC owner-checks auth.uid() == post.user_id
  const { data: { session }, error: signInErr } = await admin.auth.signInWithPassword({
    email: AUTHOR_EMAIL,
    password: AUTHOR_PASSWORD,
  })
  expect(signInErr).toBeNull()
  expect(session?.access_token).toBeTruthy()

  const { createClient } = await import('@supabase/supabase-js')
  const authorClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${session!.access_token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )

  // Helper: query notifications via Management API SQL (bypasses PostgREST RLS layer).
  // The Supabase JS admin client's REST SELECT applies RLS even with service_role key
  // because PostgREST runs as service_role (not postgres), which is subject to RLS policies
  // for SELECT. The Management API connects as postgres (superuser) → guaranteed bypass.
  const queryNotifications = async (postId: string) => {
    // Load the access token from .env.local directly (not in playwright webServer env)
    const { readFileSync } = await import('fs')
    const envContent = readFileSync('/Users/jelalconnor/CODING/CURSOR/FEED./apps/web/.env.local', 'utf-8')
    const token = envContent.split('\n').find(l => l.startsWith('SUPABASE_ACCESS_TOKEN='))
      ?.replace('SUPABASE_ACCESS_TOKEN=', '').replace(/"/g, '').trim() ?? ''

    const res = await fetch(
      `https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `SELECT id, user_id, type, link FROM public.notifications WHERE link = '/?post=${postId}';`,
        }),
      }
    )
    return res.json() as Promise<Array<{ id: string; user_id: string; type: string; link: string }>>
  }

  // ── First call ───────────────────────────────────────────────────────────
  const { data: firstCallData, error: firstErr } = await authorClient.rpc(
    'notify_seekers_near_resource',
    { p_post_id: notifyTestPostId, p_radius_miles: 10 }
  )
  expect(firstErr).toBeNull()
  expect(typeof firstCallData).toBe('number')
  expect(firstCallData).toBe(2)  // seeker1 + seeker2 in-radius
  console.log(`[geo-outreach] first notify call returned: ${firstCallData}`)

  // Verify via Management API SQL (true superuser bypass)
  const notifs1 = await queryNotifications(notifyTestPostId)
  console.log(`[geo-outreach] notifications found after first call: ${notifs1.length}`)
  expect(notifs1.length).toBe(2)

  const notifiedIds = notifs1.map((n) => n.user_id).sort()
  const expectedIds = [seekerIds[0], seekerIds[1]].sort()
  expect(notifiedIds).toEqual(expectedIds)
  console.log(`[geo-outreach] notified user_ids: ${notifiedIds.join(', ')}`)

  // ── Second call (dedup) ──────────────────────────────────────────────────
  const { data: secondCallData, error: secondErr } = await authorClient.rpc(
    'notify_seekers_near_resource',
    { p_post_id: notifyTestPostId, p_radius_miles: 10 }
  )
  expect(secondErr).toBeNull()
  expect(secondCallData).toBe(0)  // dedup: 0 new inserts
  console.log(`[geo-outreach] dedup second call returned: ${secondCallData} (expected 0)`)

  // Confirm count is STILL 2 (no double-insert)
  const notifs2 = await queryNotifications(notifyTestPostId)
  expect(notifs2.length).toBe(2)
  console.log('[geo-outreach] dedup confirmed: still 2 after second call')
})

test('composer shows geo-seeker-count when resource linked + toggle on; submit shows geo-notify-result', async ({ page }) => {
  // Sign in as author
  await page.goto('/login')
  await page.fill('#email', AUTHOR_EMAIL)
  await page.fill('#password', AUTHOR_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })
  await page.locator('[data-testid="sidebar-feed"]').click()
  await expect(page.locator('[role="tabpanel"]#feed-panel-feed')).toBeVisible({ timeout: 15_000 })
  console.log('[geo-outreach] UI: feed panel visible')

  // Resource selector must appear with our resource option
  const resourceSelector = page.locator('select[aria-label="Link a resource (optional)"]')
  await expect(resourceSelector).toBeVisible({ timeout: 10_000 })
  await resourceSelector.selectOption({ value: resourceId })
  console.log('[geo-outreach] UI: resource selected')

  // Geo-outreach toggle appears
  const toggle = page.locator('[data-testid="geo-outreach-toggle"]')
  await expect(toggle).toBeVisible({ timeout: 5_000 })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  console.log('[geo-outreach] UI: toggle on')

  // Radius selector visible
  const radiusSelect = page.locator('[data-testid="geo-outreach-radius"]')
  await expect(radiusSelect).toBeVisible({ timeout: 5_000 })

  // Seeker count resolves (stops saying "Loading...")
  const seekerCount = page.locator('[data-testid="geo-seeker-count"]')
  await expect(seekerCount).toBeVisible({ timeout: 10_000 })
  await expect(seekerCount).not.toContainText('Loading', { timeout: 12_000 })
  const countText = await seekerCount.textContent()
  console.log(`[geo-outreach] UI: seeker count text: "${countText}"`)
  expect(countText).toMatch(/seeker/i)

  // Type content and submit
  await page.locator('input[placeholder="Share an update, request, or offer..."]').fill('E2E geo-outreach UI test post')
  // Click the send button (icon button in the composer)
  await page.locator('div.mb-4 button').filter({ has: page.locator('svg') }).first().click()
  console.log('[geo-outreach] UI: post submitted')

  // Geo-notify result banner appears
  const notifyResult = page.locator('[data-testid="geo-notify-result"]')
  await expect(notifyResult).toBeVisible({ timeout: 20_000 })
  const resultText = await notifyResult.textContent()
  console.log(`[geo-outreach] UI: geo-notify-result: "${resultText}"`)
  expect(resultText).toMatch(/seeker|Notified/i)
})
