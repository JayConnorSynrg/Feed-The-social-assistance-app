/**
 * post-type-wizard.spec.ts — E2E regression guard for the PostTypeWizard.
 *
 * Verifies: trigger visibility, dialog open/close, type selection cards,
 * step navigation, shortcut icon bar, and per-type compose form fields.
 *
 * Requires: E2E_TEST_EMAIL + E2E_TEST_PASSWORD in apps/web/.env.local
 * Run with: npx playwright test e2e/post-type-wizard.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function signIn(page: Page): Promise<void> {
  await page.goto('/login')
  await page.fill('[name="email"]', process.env.E2E_TEST_EMAIL ?? '')
  await page.fill('[name="password"]', process.env.E2E_TEST_PASSWORD ?? '')
  await page.click('[type="submit"]')
  await page.waitForURL('/', { timeout: 20_000 })
}

// ─── Suite ───────────────────────────────────────────────────────────────────

test.describe('Post Type Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
    // Ensure the feed panel is active and wizard trigger is reachable
    await page.waitForSelector('[data-testid="post-wizard-trigger"]', { timeout: 15_000 })
  })

  test('wizard trigger button is visible for authenticated users', async ({ page }) => {
    const trigger = page.getByTestId('post-wizard-trigger')
    await expect(trigger).toBeVisible()
  })

  test('clicking + button opens wizard dialog', async ({ page }) => {
    await page.getByTestId('post-wizard-trigger').click()
    await expect(page.getByText('What would you like to share?')).toBeVisible({ timeout: 8_000 })
  })

  test('icon bar shortcuts are visible', async ({ page }) => {
    await expect(page.getByTestId('shortcut-seeker')).toBeVisible()
    await expect(page.getByTestId('shortcut-offer')).toBeVisible()
    await expect(page.getByTestId('shortcut-poll')).toBeVisible()
    await expect(page.getByTestId('shortcut-event')).toBeVisible()
    await expect(page.getByTestId('shortcut-petition')).toBeVisible()
  })

  test('type selection shows 8 post type cards', async ({ page }) => {
    await page.getByTestId('post-wizard-trigger').click()
    await expect(page.getByText('What would you like to share?')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('General Update')).toBeVisible()
    await expect(page.getByText('Seeking Help')).toBeVisible()
    await expect(page.getByText('Offering Help')).toBeVisible()
    await expect(page.getByText('Link a Resource')).toBeVisible()
    await expect(page.getByText('Community Poll')).toBeVisible()
    await expect(page.getByText('Community Event')).toBeVisible()
    await expect(page.getByText('Safety Warning')).toBeVisible()
    await expect(page.getByText('Petition Draft')).toBeVisible()
  })

  test('selecting a type advances to compose step', async ({ page }) => {
    await page.getByTestId('post-wizard-trigger').click()
    await expect(page.getByText('What would you like to share?')).toBeVisible({ timeout: 8_000 })
    await page.getByText('General Update').click()
    // Compose step: back button + textarea present
    await expect(page.getByRole('button', { name: /back/i })).toBeVisible()
    await expect(page.getByPlaceholder(/share an update with the community/i)).toBeVisible()
  })

  test('back button returns to type selection', async ({ page }) => {
    await page.getByTestId('post-wizard-trigger').click()
    await expect(page.getByText('What would you like to share?')).toBeVisible({ timeout: 8_000 })
    await page.getByText('General Update').click()
    await page.getByRole('button', { name: /back/i }).click()
    await expect(page.getByText('What would you like to share?')).toBeVisible()
  })

  test('closing dialog resets to type selection', async ({ page }) => {
    await page.getByTestId('post-wizard-trigger').click()
    await expect(page.getByText('What would you like to share?')).toBeVisible({ timeout: 8_000 })
    await page.getByText('General Update').click()
    // Close via X button
    await page.getByRole('button', { name: /close/i }).click()
    // Re-open — should be back at type selection
    await page.getByTestId('post-wizard-trigger').click()
    await expect(page.getByText('What would you like to share?')).toBeVisible({ timeout: 8_000 })
  })

  test('community poll compose shows question + options fields', async ({ page }) => {
    await page.getByTestId('post-wizard-trigger').click()
    await expect(page.getByText('What would you like to share?')).toBeVisible({ timeout: 8_000 })
    await page.getByText('Community Poll').click()
    await expect(page.getByPlaceholder(/ask the community/i)).toBeVisible()
    // Two option inputs by default
    const optionInputs = page.getByPlaceholder(/option/i)
    await expect(optionInputs).toHaveCount(2)
  })

  test('poll add option button adds a new option field', async ({ page }) => {
    await page.getByTestId('post-wizard-trigger').click()
    await expect(page.getByText('What would you like to share?')).toBeVisible({ timeout: 8_000 })
    await page.getByText('Community Poll').click()
    await page.getByRole('button', { name: /add option/i }).click()
    const optionInputs = page.getByPlaceholder(/option/i)
    await expect(optionInputs).toHaveCount(3)
  })

  test('seeker request compose shows category chips', async ({ page }) => {
    await page.getByTestId('post-wizard-trigger').click()
    await expect(page.getByText('What would you like to share?')).toBeVisible({ timeout: 8_000 })
    await page.getByText('Seeking Help').click()
    await expect(page.getByRole('button', { name: /food/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /housing/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /health/i })).toBeVisible()
  })

  test('community event compose shows date fields', async ({ page }) => {
    await page.getByTestId('post-wizard-trigger').click()
    await expect(page.getByText('What would you like to share?')).toBeVisible({ timeout: 8_000 })
    await page.getByText('Community Event').click()
    await expect(page.getByPlaceholder(/event name/i)).toBeVisible()
    await expect(page.locator('input[type="datetime-local"]').first()).toBeVisible()
  })

  test('safety warning closes wizard and navigates to map', async ({ page }) => {
    await page.getByTestId('post-wizard-trigger').click()
    await expect(page.getByText('What would you like to share?')).toBeVisible({ timeout: 8_000 })
    await page.getByText('Safety Warning').click()
    // Safety warning closes the dialog immediately (no compose step)
    await expect(page.getByText('What would you like to share?')).not.toBeVisible({ timeout: 3_000 })
  })
})
