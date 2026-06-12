/**
 * name-privacy-reveal.spec.ts — Audit hole #9: cross-user name-privacy lockdown.
 *
 * The core security assertion of this PR. The privacy rule:
 *   - FIRST NAME is public on every cross-user/anon surface.
 *   - LAST NAME (surname) reveals ONLY inside a conversation, ASYMMETRICALLY:
 *       the SEEKER's (requester_id) full name reveals to the SOURCER (volunteer_id);
 *       the SOURCER stays first-name-only to the SEEKER.
 *
 * Coverage:
 *  (1) SOURCER (volunteer) opens the conversation → sees the SEEKER's FULL name
 *      (first + last).
 *  (2) SEEKER (requester) opens the conversation → sees ONLY the SOURCER's FIRST
 *      name; the sourcer's surname is NEVER present in the rendered DOM.
 *  (3) A public surface (the social /s/post page) shows the author's FIRST name
 *      only — surname absent.
 *
 * Strategy: provision two users with distinct first/last names, seed an active
 * conversation (seeker initiated), drive the Messages panel UI as each party,
 * and assert the rendered counterparty name. Cleanup in afterAll.
 *
 * Run:
 *   npx playwright test apps/web/e2e/name-privacy-reveal.spec.ts --reporter=line
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const USER_PASSWORD = 'Test-NamePriv-123!'
const TS = '20260612namepriv'
const SOURCER_EMAIL = `e2e+src-${TS}@feed.local`
const SEEKER_EMAIL = `e2e+seek-${TS}@feed.local`
const RESOURCE_NAME = `E2E Name Privacy Resource ${TS}`

// Distinct, unambiguous name parts so assertions can't accidentally pass.
const SOURCER_FIRST = 'Soraya'
const SOURCER_LAST = 'Quibblethorpe' // must NEVER appear to the seeker
const SEEKER_FIRST = 'Davian'
const SEEKER_LAST = 'Marchetti' // must appear to the sourcer

let admin: SupabaseClient
let sourcerId: string
let seekerId: string
let resourceId: string
let conversationId: string

function makeAdmin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function createUser(email: string, first: string, last: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: USER_PASSWORD,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`)
  const id = data.user.id
  // Set the public profile name parts explicitly. The handle_new_user trigger
  // created the row; we set first_name/last_name (the privacy columns) here.
  const { error: pErr } = await admin
    .from('profiles')
    .update({
      first_name: first,
      last_name: last,
      full_name: `${first} ${last}`,
      onboarding_completed: true,
    })
    .eq('id', id)
  if (pErr) throw new Error(`profile update ${email}: ${pErr.message}`)
  return id
}

async function loginAndOpenConversation(page: Page, email: string) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', USER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })

  await page.locator('[data-testid="sidebar-feed"]').waitFor({ state: 'visible', timeout: 20_000 })
  await page.locator('[data-testid="sidebar-feed"]').click()
  await page.locator('#feed-tab-messages').click()
  const panel = page.locator('[role="tabpanel"]#feed-panel-messages')
  await expect(panel).toBeVisible({ timeout: 15_000 })

  // Open the single seeded conversation card.
  const card = panel.locator('button').filter({ hasText: new RegExp(`${SOURCER_FIRST}|${SEEKER_FIRST}`) }).first()
  await card.waitFor({ state: 'visible', timeout: 15_000 })
  await card.click()
  return panel
}

test.beforeAll(async () => {
  admin = makeAdmin()

  // Clean any prior run.
  const { data: existing } = await admin.auth.admin.listUsers()
  for (const email of [SOURCER_EMAIL, SEEKER_EMAIL]) {
    const prior = existing?.users?.find((u) => u.email === email)
    if (prior) await admin.auth.admin.deleteUser(prior.id)
  }
  await admin.from('resources').delete().ilike('name', `%${TS}%`)

  sourcerId = await createUser(SOURCER_EMAIL, SOURCER_FIRST, SOURCER_LAST)
  seekerId = await createUser(SEEKER_EMAIL, SEEKER_FIRST, SEEKER_LAST)

  const { data: resRow, error: resErr } = await admin
    .from('resources')
    .insert({
      name: RESOURCE_NAME,
      category: 'food',
      source: 'user_submitted',
      is_volunteer_resource: true,
      submitted_by: sourcerId,
      status: 'approved',
    })
    .select('id')
    .single()
  if (resErr || !resRow) throw new Error(`seed resource: ${resErr?.message}`)
  resourceId = resRow.id

  // Seeker initiates → conversation row exists from 'pending' onward. Use 'active'.
  const { data: convRow, error: convErr } = await admin
    .from('conversations')
    .insert({
      resource_id: resourceId,
      volunteer_id: sourcerId, // SOURCER
      requester_id: seekerId, // SEEKER (initiator)
      status: 'active',
    })
    .select('id')
    .single()
  if (convErr || !convRow) throw new Error(`seed conversation: ${convErr?.message}`)
  conversationId = convRow.id

  // Seed one opening message so the thread isn't empty.
  await admin.from('messages').insert({
    conversation_id: conversationId,
    sender_id: seekerId,
    content: 'Hello, I could use some help with this resource.',
    is_read: false,
  })
})

// (1) SOURCER sees the SEEKER's FULL name.
test('sourcer (volunteer) sees the seeker full name (first + last)', async ({ page }) => {
  const panel = await loginAndOpenConversation(page, SOURCER_EMAIL)
  // The conversation header shows the counterparty (seeker) name.
  // Assert BOTH first and last name are present.
  await expect(panel.getByText(SEEKER_FIRST, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
  await expect(panel.getByText(SEEKER_LAST, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
  // The full composed name appears.
  await expect(panel.getByText(`${SEEKER_FIRST} ${SEEKER_LAST}`, { exact: false }).first())
    .toBeVisible({ timeout: 15_000 })
})

// (2) SEEKER sees ONLY the SOURCER's FIRST name — surname must be absent.
test('seeker (requester) sees sourcer FIRST name only — surname never in DOM', async ({ page }) => {
  const panel = await loginAndOpenConversation(page, SEEKER_EMAIL)
  // First name is present.
  await expect(panel.getByText(SOURCER_FIRST, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
  // The sourcer's SURNAME must NOT appear anywhere in the rendered page.
  await expect(page.locator(`text=${SOURCER_LAST}`)).toHaveCount(0)
})

// (3) Cross-user FEED surface shows author FIRST name only (surname absent).
//     Exercises the real feed-panel.tsx cross-user profile join repoint. The
//     feed SELECT requires an authenticated viewer (profiles RLS gates anon),
//     so we view as the SEEKER — a normal authed user who is NOT the author.
test('cross-user feed shows author first name only (surname absent)', async ({ page }) => {
  // Seed a public post authored by the SOURCER.
  const { data: postRow, error: postErr } = await admin
    .from('posts')
    .insert({
      user_id: sourcerId,
      content: `E2E name-privacy feed post ${TS}`,
      post_type: 'feed',
    })
    .select('id')
    .single()
  if (postErr || !postRow) throw new Error(`seed post: ${postErr?.message}`)

  try {
    // Log in as the SEEKER (not the author) and open the feed.
    await page.goto('/login')
    await page.fill('#email', SEEKER_EMAIL)
    await page.fill('#password', USER_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30_000 })
    await page.locator('[data-testid="sidebar-feed"]').waitFor({ state: 'visible', timeout: 20_000 })
    await page.locator('[data-testid="sidebar-feed"]').click()

    // Find the seeded post by its unique content, then assert the author name.
    const postText = page.getByText(`E2E name-privacy feed post ${TS}`).first()
    await postText.waitFor({ state: 'visible', timeout: 20_000 })

    // The author's FIRST name appears on the cross-user feed surface.
    await expect(page.getByText(SOURCER_FIRST, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
    // The author's SURNAME must NOT appear anywhere in the rendered feed.
    await expect(page.locator(`text=${SOURCER_LAST}`)).toHaveCount(0)
  } finally {
    await admin.from('posts').delete().eq('id', postRow.id)
  }
})

test.afterAll(async () => {
  if (!admin) return
  await admin.from('messages').delete().eq('conversation_id', conversationId)
  await admin.from('conversations').delete().eq('id', conversationId)
  await admin.from('resources').delete().ilike('name', `%${TS}%`)
  for (const id of [sourcerId, seekerId]) {
    if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  }
})
