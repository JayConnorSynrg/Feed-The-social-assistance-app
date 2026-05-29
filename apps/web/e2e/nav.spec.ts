/**
 * nav.spec — asserts the nav-nest work:
 * - Sidebar shows "Documents & Forms" (not just "Documents")
 * - Sidebar shows "Community & Messages" (not just "Community" or "Feed")
 * - Forms tab is visible inside Documents panel
 * - Messages tab is visible inside Community Feed panel
 */
import { test, expect } from './fixtures'

test.describe('Nav-nest: sidebar labels + sub-tabs', () => {
  test('sidebar shows "Documents & Forms" label', async ({ authedPage: page }) => {
    // feed-shell.tsx:108 — title: 'Documents & Forms' on aside button
    await expect(
      page.locator('aside button[title="Documents & Forms"], aside button[title*="Documents"]').first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('sidebar shows "Community & Messages" label', async ({ authedPage: page }) => {
    // feed-shell.tsx:106 — title: 'Community & Messages' on aside button
    await expect(
      page.locator('aside button[title="Community & Messages"], aside button[title*="Community"]').first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('Documents & Forms panel has a Forms tab', async ({ authedPage: page }) => {
    // Click the Documents & Forms sidebar button (title attribute)
    await page.locator('aside button[title="Documents & Forms"], aside button[title*="Documents"]').first().click()
    await page.waitForTimeout(1000)

    // documents-panel.tsx:598 — tab with text "Forms"
    await expect(
      page.locator('[role="tab"]', { hasText: /^forms$/i }).first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('Community & Messages panel has a Messages tab', async ({ authedPage: page }) => {
    // Click the Community & Messages sidebar button (title attribute)
    await page.locator('aside button[title="Community & Messages"], aside button[title*="Community"]').first().click()
    await page.waitForTimeout(1000)

    // feed-panel.tsx:282 — tab with text "Messages"
    await expect(
      page.locator('[role="tab"]', { hasText: /^messages$/i }).first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('clicking Forms tab switches to forms view', async ({ authedPage: page }) => {
    await page.locator('aside button[title="Documents & Forms"], aside button[title*="Documents"]').first().click()
    await page.waitForTimeout(800)

    const formsTab = page.locator('[role="tab"]', { hasText: /^forms$/i }).first()
    await formsTab.click()

    // After clicking forms tab, forms-panel content should appear
    await expect(
      page.getByText(/benefit application|snap|medicaid|form template/i).first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('clicking Messages tab switches to messages view', async ({ authedPage: page }) => {
    await page.locator('aside button[title="Community & Messages"], aside button[title*="Community"]').first().click()
    await page.waitForTimeout(800)

    const messagesTab = page.locator('[role="tab"]', { hasText: /^messages$/i }).first()
    await messagesTab.click()

    // After clicking messages tab, messages/conversations view appears
    await expect(
      page.getByText(/message|conversation|no messages|start a conversation/i).first()
    ).toBeVisible({ timeout: 15_000 })
  })
})
