/**
 * Shared fixtures for FEED smoke tests.
 * Reads the shared test user created by global-setup.ts.
 * delete-account.spec uses its own ephemeral user (see createEphemeralUser).
 */
import { test as base, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://ndtpovonpadugthmcntl.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const BASE_URL = process.env.BASE_URL ?? 'https://www.sourcetofeed.com'
const CREDS_FILE = path.join(__dirname, '.smoke-test-user.json')

export { expect }

export type TestUser = {
  email: string
  password: string
  userId: string
}

/**
 * Read the shared test user created by global-setup.ts.
 */
export function getSharedTestUser(): TestUser {
  if (!fs.existsSync(CREDS_FILE)) {
    throw new Error(`Shared test user creds not found at ${CREDS_FILE}. Did global-setup run?`)
  }
  return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf-8'))
}

/**
 * Create an ephemeral user for tests that destroy themselves (delete-account.spec).
 */
export async function createEphemeralUser(suffix = ''): Promise<TestUser> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const ts = Date.now()
  const email = `smoke-ephemeral-${ts}${suffix}@feed-test.invalid`
  const password = `Ephemeral_${ts}!`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`Failed to create ephemeral user: ${error?.message}`)
  }
  const userId = data.user.id

  await admin
    .from('profiles')
    .upsert(
      { id: userId, onboarding_completed: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )

  return { email, password, userId }
}

/**
 * Delete a test user via service-role.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  await admin.from('profiles').delete().eq('id', userId)
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) console.warn(`Cleanup warning: ${error.message}`)
}

/**
 * Log in via the FEED login UI and wait for the root SPA.
 */
export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  // Wait until we leave /login (may go to / or /onboarding)
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 25_000 })
  // If landed on onboarding, navigate to root — shared user has onboarding_completed=true
  // so middleware will let us through
  if (page.url().includes('/onboarding')) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  }
}

// ─── Fixture: authenticated page using the SHARED user ─────────────────────

type AuthFixtures = {
  authedPage: Page
}

export const test = base.extend<AuthFixtures>({
  authedPage: [
    async ({ page }, use) => {
      const user = getSharedTestUser()
      await loginViaUI(page, user.email, user.password)
      // Ensure we're on root — shared user has onboarding_completed=true
      await page.waitForURL((url) => url.pathname === '/', { timeout: 20_000 })
      await use(page)
    },
    { scope: 'test' },
  ],
})
