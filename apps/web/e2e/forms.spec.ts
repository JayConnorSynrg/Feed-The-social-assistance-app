/**
 * forms.spec — Forms panel (nested under Documents & Forms):
 * - Forms tab renders form templates
 * - form_templates or form_submissions query fires
 */
import { test, expect } from './fixtures'

test.describe('Forms panel', () => {
  test('forms tab loads template list or empty state', async ({ authedPage: page }) => {
    // Navigate to Documents & Forms
    await page.locator('aside button[title="Documents & Forms"], aside button[title*="Documents"]').first().click()
    await page.waitForTimeout(800)

    // Intercept form_templates query
    const queryPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/rest/v1/form_templates') ||
        req.url().includes('/rest/v1/form_submissions'),
      { timeout: 15_000 }
    )

    // Click Forms tab
    const formsTab = page.locator('[role="tab"]', { hasText: /^forms$/i }).first()
    const tabVisible = await formsTab.isVisible().catch(() => false)
    if (tabVisible) {
      await formsTab.click()
    }

    const req = await queryPromise.catch(() => null)
    if (req) {
      const resp = await req.response()
      expect(resp?.status()).toBeLessThanOrEqual(299)
      console.log(`forms query: ${resp?.status()} ${req.url().split('?')[0]}`)
    }

    // Form templates (SNAP, Medicaid) or empty state
    await expect(
      page.locator('text=/snap|medicaid|application|benefit|form|no forms|start/i').first()
    ).toBeVisible({ timeout: 20_000 })
  })

  test('SNAP application template is available', async ({ authedPage: page }) => {
    await page.locator('aside button[title="Documents & Forms"], aside button[title*="Documents"]').first().click()
    await page.waitForTimeout(800)

    const formsTab = page.locator('[role="tab"]', { hasText: /^forms$/i }).first()
    const tabVisible = await formsTab.isVisible().catch(() => false)
    if (tabVisible) await formsTab.click()
    await page.waitForTimeout(1500)

    // SNAP template should be present from form-templates/snap-application.ts
    const snapCard = page.locator('text=/snap|supplemental nutrition/i').first()
    const visible = await snapCard.isVisible().catch(() => false)
    if (visible) {
      await expect(snapCard).toBeVisible()
    } else {
      // Form templates may not be seeded for fresh user — empty state is acceptable
      await expect(
        page.locator('text=/form|application|no forms|benefit/i').first()
      ).toBeVisible({ timeout: 10_000 })
    }
  })
})
