/**
 * auth.spec — login + logout smoke tests using the shared test user.
 * delete-account has its own spec with its own ephemeral user.
 */
import { test, expect, getSharedTestUser, loginViaUI } from './fixtures'

const BASE_URL = process.env.BASE_URL ?? 'https://www.sourcetofeed.com'

test.describe('Auth — login / logout', () => {
  test('login succeeds and lands on root SPA', async ({ page }) => {
    const user = getSharedTestUser()
    await loginViaUI(page, user.email, user.password)
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
  })

  test('logout redirects to /login', async ({ authedPage: page }) => {
    // The sign-out dropdown is in the TopNav — look for the user avatar/button
    // feed-shell.tsx:177 does router.push('/login') after signOut()
    // The button that triggers the sign-out is inside a dropdown

    // Try to find sign-out via the user display in top-nav
    // TopNav shows user email truncated or a user icon button
    const topNavSignOut = page.locator('button', { hasText: /sign.?out/i }).first()
    const visible = await topNavSignOut.isVisible().catch(() => false)

    if (!visible) {
      // Open the dropdown — look for user avatar/email button in header
      const userBtn = page.locator('header button').filter({ hasText: /smoke|@/i }).first()
      const userBtnVisible = await userBtn.isVisible().catch(() => false)
      if (userBtnVisible) {
        await userBtn.click()
        await page.waitForTimeout(500)
      }
    }

    // After any dropdown open, click Sign Out
    await page.locator('button', { hasText: /sign.?out/i }).first().click()
    await page.waitForURL(/\/login/, { timeout: 20_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})
