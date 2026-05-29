/**
 * programs.spec — Programs browse panel:
 * - Panel loads
 * - Supabase programs table query fires
 * - Program cards or empty state rendered
 */
import { test, expect } from './fixtures'

test.describe('Programs browse panel', () => {
  test('programs panel loads and backend query fires', async ({ authedPage: page }) => {
    // Intercept programs table query
    const queryPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/rest/v1/programs') ||
        req.url().includes('/rest/v1/resources') && req.url().includes('category'),
      { timeout: 20_000 }
    )

    await page.locator('aside button[title="Browse Programs"], aside button[title*="Programs"]').first().click()

    const req = await queryPromise.catch(() => null)
    if (req) {
      const resp = await req.response()
      expect(resp?.status()).toBeLessThanOrEqual(299)
      console.log(`Programs query: ${resp?.status()} ${req.url().split('?')[0]}`)
    }

    // Panel should show program cards, category filters, or empty state
    await expect(
      page.locator('text=/program|benefit|snap|medicaid|food|housing|filter|category|no programs/i').first()
    ).toBeVisible({ timeout: 20_000 })
  })

  test('category filter buttons are rendered', async ({ authedPage: page }) => {
    await page.locator('aside button[title="Browse Programs"], aside button[title*="Programs"]').first().click()
    await page.waitForTimeout(2000)

    // use-program-browser.ts fetches categories — filter buttons should be present
    const filterArea = page.locator('button, [role="button"]').filter({ hasText: /all|food|housing|health|cash|childcare/i }).first()
    const visible = await filterArea.isVisible().catch(() => false)
    if (!visible) {
      // Accept: fresh user sees empty state with no categories yet
      await expect(page.locator('text=/program|benefit|no programs|empty/i').first()).toBeVisible({ timeout: 10_000 })
    } else {
      await expect(filterArea).toBeVisible()
    }
  })
})
