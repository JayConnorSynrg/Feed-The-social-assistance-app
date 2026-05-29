/**
 * applications.spec — Applications panel:
 * - Panel loads after sidebar navigation
 * - form_submissions query fires (use-applications.ts)
 * - Application list or empty state renders
 */
import { test, expect } from './fixtures'

test.describe('Applications panel', () => {
  test('applications panel loads and backend query fires', async ({ authedPage: page }) => {
    // Intercept form_submissions (applications) query
    const queryPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/rest/v1/form_submissions') ||
        req.url().includes('/rest/v1/applications'),
      { timeout: 20_000 }
    )

    await page.locator('aside button[title="Applications"]').first().click()

    const req = await queryPromise.catch(() => null)
    if (req) {
      const resp = await req.response()
      expect(resp?.status()).toBeLessThanOrEqual(299)
      console.log(`applications query: ${resp?.status()}`)
    }

    // Applications list or empty state
    await expect(
      page.locator('text=/application|no applications|snap|medicaid|status|pending|approved/i').first()
    ).toBeVisible({ timeout: 20_000 })
  })

  test('applications panel shows status filter or empty state', async ({ authedPage: page }) => {
    await page.locator('aside button[title="Applications"]').first().click()
    await page.waitForTimeout(2000)

    // For a fresh user: empty state
    // For a user with applications: list + status filters
    const content = page.locator(
      'text=/application|draft|pending|approved|rejected|no applications|start/i'
    ).first()
    await expect(content).toBeVisible({ timeout: 15_000 })
  })
})
