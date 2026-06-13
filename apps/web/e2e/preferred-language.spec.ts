/**
 * preferred-language.spec.ts — Preferred Language feature E2E
 *
 * Coverage (4 flows):
 *   A. New user completes onboarding step 5 (language) → profiles.preferred_language
 *      persists in DB (admin-created user, sign-in via UI, onboarding_completed=false).
 *   B. Authenticated user navigates to Settings → Language → changes language → DB persists.
 *   C. Guest localStorage: set via evaluate() → chat request route-intercept assert.
 *   D. Auth profile preferred_language='es' → chat request body carries 'es' (route intercept).
 *
 * TEARDOWN: afterAll deletes test users via admin API (idempotent).
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import path from 'path'
import dotenv from 'dotenv'

// Load env — .env.local is symlinked in worktree to shared checkout copy
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// ---------------------------------------------------------------------------
// Admin client
// ---------------------------------------------------------------------------

function makeAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error(`Missing env vars. URL=${url?.slice(0,20)}, KEY=${key ? 'present' : 'missing'}`)
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RUN_TS = Date.now()

function testEmail(label: string): string {
  return `e2e+lang-${label}-${RUN_TS}@feed.local`
}

const TEST_PASSWORD = 'E2eLangPass!2026#$'

async function deleteUserByEmail(admin: SupabaseClient, email: string): Promise<void> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const user = data?.users?.find((u) => u.email === email)
  if (user) await admin.auth.admin.deleteUser(user.id)
}

async function createConfirmedUser(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  return data.user.id
}

async function getPreferredLanguage(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin
    .from('profiles')
    .select('preferred_language')
    .eq('id', userId)
    .single()
  return (data as { preferred_language: string | null } | null)?.preferred_language ?? null
}

/** Log in via the login form and wait for root. */
async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 20_000 })
}

/** Activate guest session via "Find Help Now" button on login page. */
async function guestSession(page: Page) {
  await page.goto('/login')
  await page.click('[data-testid="guest-access-btn"]')
  await page.waitForURL('/', { timeout: 20_000 })
}

// ---------------------------------------------------------------------------
// Flow A: Onboarding language step → DB persistence
// ---------------------------------------------------------------------------

test.describe('Flow A: onboarding language step → DB', () => {
  const email = testEmail('onboarding')
  let admin: SupabaseClient
  let userId: string

  test.beforeAll(async () => {
    admin = makeAdmin()
    await deleteUserByEmail(admin, email)
    // Create confirmed user (handle_new_user trigger creates the profile row)
    userId = await createConfirmedUser(admin, email)
    // Poll until profile row exists (trigger is async; up to 5s)
    for (let i = 0; i < 10; i++) {
      const { data } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle()
      if (data) break
      await new Promise((r) => setTimeout(r, 500))
    }
    // Force onboarding_completed=false so proxy redirects to /onboarding
    await admin
      .from('profiles')
      .update({ onboarding_completed: false })
      .eq('id', userId)
  })

  test.afterAll(async () => {
    await deleteUserByEmail(admin, email)
  })

  test('A1: step 5 language picker persists to DB', async ({ page }) => {
    // Log in — proxy should redirect to /onboarding since onboarding_completed=false
    await page.goto('/login')
    await page.fill('#email', email)
    await page.fill('#password', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/onboarding/, { timeout: 20_000 })

    // Step 1: role
    await page.click('button:has-text("Seeker")')
    await page.click('button:has-text("Continue")')

    // Step 2: location
    await page.fill('input[placeholder="90001"]', '90210')
    await page.click('button:has-text("Continue")')

    // Step 3: needs (pick one)
    await page.click('button:has-text("Food Assistance")')
    await page.click('button:has-text("Continue")')

    // Step 4: phone → Continue to step 5
    await page.click('button:has-text("Continue")')

    // Step 5: language picker
    const select = page.locator('[data-testid="language-select"]')
    await expect(select).toBeVisible({ timeout: 10_000 })

    // Pick Spanish
    await select.selectOption('es')
    await expect(select).toHaveValue('es')

    // Submit onboarding — triggers handleComplete → writes preferred_language +
    // onboarding_completed → router.push('/').
    await page.click('button:has-text("Get Started")')

    // DB assertion: poll for preferred_language='es' (up to 15s).
    // The proxy read at '/' races with the client write. Asserting via the admin
    // client bypasses SSR caching and confirms the write committed.
    let stored: string | null = null
    let onboardingCompleted: boolean | null = null
    for (let i = 0; i < 30; i++) {
      const { data } = await admin
        .from('profiles')
        .select('preferred_language, onboarding_completed')
        .eq('id', userId)
        .maybeSingle()
      stored = (data as { preferred_language: string | null; onboarding_completed: boolean | null } | null)?.preferred_language ?? null
      onboardingCompleted = (data as { preferred_language: string | null; onboarding_completed: boolean | null } | null)?.onboarding_completed ?? null
      if (stored === 'es') break
      await page.waitForTimeout(500)
    }
    expect(stored).toBe('es')
    expect(onboardingCompleted).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Flow B: Settings panel Language nav → DB persistence
// ---------------------------------------------------------------------------

test.describe('Flow B: settings language picker → DB', () => {
  const email = testEmail('settings')
  let admin: SupabaseClient
  let userId: string

  test.beforeAll(async () => {
    admin = makeAdmin()
    await deleteUserByEmail(admin, email)
    userId = await createConfirmedUser(admin, email)
    await admin.from('profiles').update({ onboarding_completed: true }).eq('id', userId)
  })

  test.afterAll(async () => {
    await deleteUserByEmail(admin, email)
  })

  test('B1: language change in Settings → Language → persists to DB', async ({ page }) => {
    await loginAs(page, email, TEST_PASSWORD)

    // Open settings panel via sidebar
    await page.click('[data-testid="sidebar-settings"]')
    await page.waitForTimeout(500)

    // Click "Language" nav item — use exact label match within settings sidebar
    const langNavBtn = page.locator('button', { hasText: 'Language' }).first()
    await langNavBtn.click()

    // Language select should appear
    await expect(page.locator('[data-testid="settings-language-select"]')).toBeVisible({ timeout: 10_000 })

    // Select Vietnamese
    await page.locator('[data-testid="settings-language-select"]').selectOption('vi')

    // Component auto-saves on change
    await expect(page.locator('text=Language saved')).toBeVisible({ timeout: 10_000 })

    // DB assertion
    const stored = await getPreferredLanguage(admin, userId)
    expect(stored).toBe('vi')
  })
})

// ---------------------------------------------------------------------------
// Flow C: Guest localStorage + chat request intercept
// ---------------------------------------------------------------------------

test.describe('Flow C: guest localStorage → chat preferredLanguage', () => {
  test('C1: localStorage set after guest session', async ({ page }) => {
    await guestSession(page)

    // Directly set the localStorage value (simulating guest language picker action)
    await page.evaluate((key) => localStorage.setItem(key, 'ht'), 'feed_preferred_language')

    // Assert the value is set
    const stored = await page.evaluate((key) => localStorage.getItem(key), 'feed_preferred_language')
    expect(stored).toBe('ht')
  })

  test('C2: guest chat request carries preferredLanguage from localStorage', async ({ page }) => {
    await guestSession(page)

    // Pre-set localStorage before opening chat
    await page.evaluate((key) => localStorage.setItem(key, 'ht'), 'feed_preferred_language')

    // Intercept chat function call
    let capturedBody: Record<string, unknown> | null = null
    await page.route('**/functions/v1/chat', async (route) => {
      const request = route.request()
      try {
        capturedBody = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
      } catch {
        capturedBody = {}
      }
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' },
        body: 'data: {"type":"content","content":"Bonjou!"}\ndata: {"type":"done"}\n\n',
      })
    })

    // Open chat panel
    await page.click('[data-testid="sidebar-chat"]')
    await page.waitForTimeout(500)

    // Chat input: placeholder depends on auth state; use any visible text input in the chat panel
    const input = page.locator('input[placeholder*="Ask me"], input[placeholder*="Type your message"]').first()
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('Hello')
    await page.keyboard.press('Enter')

    // Wait for request to fire
    await page.waitForTimeout(3_000)

    expect(capturedBody).not.toBeNull()
    expect((capturedBody as Record<string, unknown>)['preferredLanguage']).toBe('ht')
  })
})

// ---------------------------------------------------------------------------
// Flow D: Auth profile preferred_language → chat request body
// ---------------------------------------------------------------------------

test.describe('Flow D: auth profile preferred_language fed to chat request', () => {
  const email = testEmail('chat-lang')
  let admin: SupabaseClient
  let userId: string

  test.beforeAll(async () => {
    admin = makeAdmin()
    await deleteUserByEmail(admin, email)
    userId = await createConfirmedUser(admin, email)
    await admin.from('profiles').update({
      onboarding_completed: true,
      preferred_language: 'es',
    }).eq('id', userId)
  })

  test.afterAll(async () => {
    await deleteUserByEmail(admin, email)
  })

  test('D1: chat request carries preferredLanguage=es from profile', async ({ page }) => {
    await loginAs(page, email, TEST_PASSWORD)

    // Intercept chat function call
    let capturedBody: Record<string, unknown> | null = null
    await page.route('**/functions/v1/chat', async (route) => {
      const request = route.request()
      try {
        capturedBody = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
      } catch {
        capturedBody = {}
      }
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' },
        body: 'data: {"type":"content","content":"Hola!"}\ndata: {"type":"done"}\n\n',
      })
    })

    // Open chat panel
    await page.click('[data-testid="sidebar-chat"]')
    await page.waitForTimeout(500)

    // Chat input: placeholder depends on auth state; use any visible text input in the chat panel
    const input = page.locator('input[placeholder*="Ask me"], input[placeholder*="Type your message"]').first()
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('Hello')
    await page.keyboard.press('Enter')

    await page.waitForTimeout(3_000)

    expect(capturedBody).not.toBeNull()
    expect((capturedBody as Record<string, unknown>)['preferredLanguage']).toBe('es')
  })
})
