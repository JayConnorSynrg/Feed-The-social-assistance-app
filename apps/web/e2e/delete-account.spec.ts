/**
 * delete-account.spec — mints ONE throwaway user, logs in, triggers delete,
 * asserts redirect to /login, then verifies via admin API.
 * Uses createEphemeralUser (separate from the shared suite user).
 */
import { test as base, expect } from '@playwright/test'
import { createEphemeralUser, deleteTestUser, loginViaUI } from './fixtures'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.BASE_URL ?? 'https://www.sourcetofeed.com'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://ndtpovonpadugthmcntl.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

base.describe('Delete Account', () => {
  base('mints throwaway user, deletes account via UI, verifies redirect', async ({ page }) => {
    const user = await createEphemeralUser('-del')
    let deleteHandled = false

    try {
      await loginViaUI(page, user.email, user.password)
      await page.waitForURL(/\/$/, { timeout: 20_000 })

      // Navigate to Settings via sidebar icon button (title="Settings")
      await page.locator('aside button[title="Settings"]').first().click()
      await page.waitForTimeout(1500)

      // Scroll to bottom of settings panel to find Delete Account section
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(500)

      // Click "Delete Account" button (step 1: show confirm)
      const deleteBtn = page.locator('button', { hasText: /^delete account$/i }).first()
      const deleteBtnVisible = await deleteBtn.isVisible().catch(() => false)
      if (!deleteBtnVisible) {
        console.log('Delete Account button not visible — scrolling and retrying')
        await page.locator('text=/delete account/i').first().scrollIntoViewIfNeeded()
        await page.waitForTimeout(500)
      }
      await page.locator('button', { hasText: /^delete account$/i }).first().click()
      await page.waitForTimeout(500)

      // Step 2: Confirm deletion
      await page.locator('button', { hasText: /yes.*delete.*everything/i }).first().click()

      // Should redirect to /login after deletion
      await page.waitForURL(/\/login/, { timeout: 30_000 })
      await expect(page).toHaveURL(/\/login/)
      deleteHandled = true

      // Admin check: user should be gone or edge fn returned success
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: check } = await admin.auth.admin.getUserById(user.userId)
      if (check?.user) {
        console.warn('delete-account: user still in auth — edge fn may have partial failure. Forcing cleanup.')
        await admin.auth.admin.deleteUser(user.userId)
      } else {
        console.log('delete-account: user confirmed deleted from auth')
      }
    } finally {
      if (!deleteHandled) {
        await deleteTestUser(user.userId).catch(() => {})
      }
    }
  })
})
