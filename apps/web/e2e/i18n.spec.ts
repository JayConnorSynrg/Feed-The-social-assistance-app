/**
 * i18n.spec.ts — Static i18n floor regression guard for login page.
 *
 * Verifies that:
 *   1. When locale is set to 'es' in localStorage, Spanish strings appear on /login
 *   2. Without a stored locale, English strings appear by default on /login
 *
 * Uses GUEST_LANGUAGE_KEY ('feed_preferred_language') to set localStorage before navigation.
 * Requires a running dev server. Skipped automatically when BASE_URL is not reachable.
 *
 * Run with: npx playwright test e2e/i18n.spec.ts
 */

import { test, expect } from '@playwright/test'

// GUEST_LANGUAGE_KEY from languages.ts
const GUEST_LANGUAGE_KEY = 'feed_preferred_language'

test.describe('i18n static floor — login page', () => {
  test('shows Spanish strings when locale is set to es', async ({ page }) => {
    // Set locale in localStorage before navigation
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'es')
    }, GUEST_LANGUAGE_KEY)

    await page.goto('/login')

    // Spanish welcome heading
    await expect(
      page.getByText('Bienvenido a FEED', { exact: false })
    ).toBeVisible({ timeout: 10_000 })

    // Spanish sign-in button
    await expect(
      page.getByRole('button', { name: /Iniciar sesión/i })
    ).toBeVisible({ timeout: 5_000 })
  })

  test('shows English strings by default', async ({ page }) => {
    // Do NOT set any locale — resolveLocale() should default to en
    await page.goto('/login')

    // English welcome heading
    await expect(
      page.getByText('Welcome to FEED', { exact: false })
    ).toBeVisible({ timeout: 10_000 })
  })
})
