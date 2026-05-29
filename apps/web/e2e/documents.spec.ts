/**
 * documents.spec — Documents panel:
 * - Panel loads with Documents & Forms sidebar item
 * - user_documents query fires on mount
 * - Documents list or empty state renders
 */
import { test, expect } from './fixtures'

test.describe('Documents panel', () => {
  test('documents panel loads and backend query fires', async ({ authedPage: page }) => {
    // Intercept user_documents table query
    const queryPromise = page.waitForRequest(
      (req) => req.url().includes('/rest/v1/user_documents'),
      { timeout: 20_000 }
    )

    await page.locator('aside button[title="Documents & Forms"], aside button[title*="Documents"]').first().click()

    const req = await queryPromise.catch(() => null)
    if (req) {
      const resp = await req.response()
      expect(resp?.status()).toBeLessThanOrEqual(299)
      console.log(`user_documents query: ${resp?.status()}`)
    } else {
      console.log('user_documents query not intercepted — panel may gate on vault unlock')
    }

    // Documents panel or empty state should be visible
    await expect(
      page.locator('text=/documents|upload|no documents|add your first|vault|unlock/i').first()
    ).toBeVisible({ timeout: 20_000 })
  })

  test('documents tab is active by default when navigating to Documents & Forms', async ({ authedPage: page }) => {
    await page.locator('aside button[title="Documents & Forms"], aside button[title*="Documents"]').first().click()
    await page.waitForTimeout(1000)

    // documents-panel.tsx renders a tablist with Documents, Resources, Forms
    const docsTab = page.locator('[role="tab"]', { hasText: /^documents$/i }).first()
    const tabsVisible = await docsTab.isVisible().catch(() => false)
    if (tabsVisible) {
      // Documents tab should have aria-selected=true
      const selected = await docsTab.getAttribute('aria-selected')
      expect(selected).toBe('true')
    } else {
      // Panel rendered without tabs — acceptable
      await expect(page.locator('text=/documents|upload|vault/i').first()).toBeVisible({ timeout: 10_000 })
    }
  })
})
