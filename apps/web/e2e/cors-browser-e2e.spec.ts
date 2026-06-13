/**
 * cors-browser-e2e.spec.ts — Real browser end-to-end proof from https://www.sourcetofeed.com
 *
 * Proves: the AI Assistant chat works from the canonical www origin — the fix for the
 * CORS regression where the browser sent Origin: https://www.sourcetofeed.com but only
 * https://sourcetofeed.com (via APP_URL) was in ALLOWED_ORIGINS, causing CORS-block on
 * every edge function call.
 *
 * OPT-IN: runs ONLY when CORS_E2E_BASE_URL is set to a deployed prod URL.
 * To run:
 *   CORS_E2E_BASE_URL=https://www.sourcetofeed.com \
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx playwright test apps/web/e2e/cors-browser-e2e.spec.ts
 *
 * The spec provisions a fresh ephemeral user in the real Supabase project, then
 * drives the chat panel through a real browser (Chromium), exactly as a real user
 * would from the www origin.
 */

import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// OPT-IN guard — skip unless an explicit prod URL is provided
// ---------------------------------------------------------------------------
const BASE_URL = process.env.CORS_E2E_BASE_URL ?? ''
test.skip(!BASE_URL, 'cors-browser-e2e.spec.ts runs only when CORS_E2E_BASE_URL is set (e.g. https://www.sourcetofeed.com)')

// ---------------------------------------------------------------------------
// Admin client for user provisioning + cleanup (service role, never in browser)
// ---------------------------------------------------------------------------
function makeAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const RUN_TS = Date.now()
const TEST_EMAIL = `e2e+cors-www-${RUN_TS}@feed.local`
const TEST_PASSWORD = 'E2eCorsWwwPass!2026#$'
const TEST_FULL_NAME = 'CORS E2E Test'

async function deleteUser(adminClient: SupabaseClient, email: string) {
  const { data } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const u = data?.users?.find((x) => x.email === email)
  if (u) await adminClient.auth.admin.deleteUser(u.id)
}

// ---------------------------------------------------------------------------
// Helper: sign in and open the chat panel's input
// ---------------------------------------------------------------------------
async function signInAndOpenChat(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })

  // Wait for the CSRF token to be populated by the useCsrfToken hook (useEffect).
  // The token is stored in the hidden input name="csrf_token" — wait until it's non-empty.
  await page.waitForFunction(
    () => {
      const input = document.querySelector('input[name="csrf_token"]') as HTMLInputElement | null
      return input && input.value.length > 0
    },
    { timeout: 10_000 }
  )

  // Use element IDs matching the actual login form
  await page.fill('#email', TEST_EMAIL)
  await page.fill('#password', TEST_PASSWORD)
  await page.click('button[type="submit"]')

  // Wait for the sidebar AI Assistant button — this is the post-auth shell signal.
  // The chat panel renders an <Input> (not <textarea>), so use the sidebar-chat
  // testid to navigate to the chat panel first.
  const aiAssistantBtn = page.locator('[data-testid="sidebar-chat"]').first()
  await expect(aiAssistantBtn).toBeVisible({ timeout: 35_000 })
  await aiAssistantBtn.click()

  // Chat panel input: shadcn <Input> renders as <input type="text"> with the
  // placeholder set when isAuthenticated=true.
  const chatInput = page.locator('input[placeholder="Ask me anything about benefits, resources, or assistance..."]')
  await expect(chatInput).toBeVisible({ timeout: 15_000 })
  return chatInput
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let adminClient: SupabaseClient

test.beforeAll(async () => {
  adminClient = makeAdmin()
  // Cleanup any leftover from a previous failed run
  await deleteUser(adminClient, TEST_EMAIL)
  // Provision fresh user
  const { data: created, error } = await adminClient.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: TEST_FULL_NAME },
  })
  if (error) throw new Error(`Failed to provision test user: ${error.message}`)

  // The handle_new_user trigger creates a profiles row with onboarding_completed=false.
  // Set it to true so the middleware proxy does not redirect to /onboarding.
  await new Promise((r) => setTimeout(r, 2000))
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', created.user.id)
  if (profileError) throw new Error(`Failed to set onboarding_completed: ${profileError.message}`)
})

test.afterAll(async () => {
  await deleteUser(adminClient, TEST_EMAIL)
})

test('www-origin browser chat: English food assistance query returns substantive reply', async ({ page }) => {
  // The browser will send Origin: https://www.sourcetofeed.com on all fetch calls.
  // This test proves the CORS fix works end-to-end from the real www origin.
  const chatInput = await signInAndOpenChat(page)

  const EN_QUERY = 'Where can I find food assistance in Burlington, Vermont?'
  await chatInput.fill(EN_QUERY)
  await chatInput.press('Enter')

  // After submit the input is cleared and a response starts streaming.
  // Wait for any message content to appear in the messages list.
  // The error case renders: "Sorry, I encountered an error. Please try again."
  // The success case renders resource info from the AI.
  // We poll the page for a non-empty message that doesn't contain the CORS-error phrase.

  // Each chat message is a div with class mb-4. The assistant reply has class
  // justify-start (vs user messages which have justify-end).
  // Wait for an assistant message to appear (justify-start = assistant side).
  const assistantMessage = page.locator('.mb-4.flex.justify-start').last()
  await expect(assistantMessage).toBeVisible({ timeout: 45_000 })

  // Wait for streaming to complete AND the reply to have real content (> 30 chars).
  await page.waitForFunction(
    () => {
      const msgs = document.querySelectorAll('.mb-4.flex.justify-start')
      const last = msgs[msgs.length - 1]
      const textBase = last?.querySelector('.text-base')
      return (textBase?.textContent?.trim().length ?? 0) > 30
    },
    { timeout: 45_000 }
  )

  // Read the full message content from the text-base div inside the assistant bubble
  const replyText = await assistantMessage.locator('.text-base').textContent()

  expect(
    replyText,
    `Expected non-error reply from www origin. Got: "${replyText?.slice(0, 200)}"`
  ).not.toContain('Sorry, I encountered an error')

  expect(replyText?.trim().length ?? 0, 'Reply should contain substantive content').toBeGreaterThan(30)

  console.log(`EN reply (first 120 chars): ${(replyText ?? '').trim().slice(0, 120)}`)
})

test('www-origin browser chat: Spanish query returns substantive reply', async ({ page }) => {
  const chatInput = await signInAndOpenChat(page)

  const ES_QUERY = '¿Dónde puedo encontrar asistencia de alimentos en Burlington, Vermont?'
  await chatInput.fill(ES_QUERY)
  await chatInput.press('Enter')

  const esAssistantMessage = page.locator('.mb-4.flex.justify-start').last()
  await expect(esAssistantMessage).toBeVisible({ timeout: 45_000 })

  // Wait for streaming to complete AND reply to have real content
  await page.waitForFunction(
    () => {
      const msgs = document.querySelectorAll('.mb-4.flex.justify-start')
      const last = msgs[msgs.length - 1]
      const textBase = last?.querySelector('.text-base')
      return (textBase?.textContent?.trim().length ?? 0) > 30
    },
    { timeout: 45_000 }
  )

  const replyText = await esAssistantMessage.locator('.text-base').textContent()

  expect(
    replyText,
    `Spanish query: Expected non-error reply. Got: "${replyText?.slice(0, 200)}"`
  ).not.toContain('Sorry, I encountered an error')

  expect(replyText?.trim().length ?? 0, 'Spanish reply should contain substantive content').toBeGreaterThan(30)

  console.log(`ES reply (first 120 chars): ${(replyText ?? '').trim().slice(0, 120)}`)
})
