/**
 * FEED Performance Walkthrough — authenticated panel-by-panel perf measurement.
 *
 * Run:
 *   TEST_USER_EMAIL=<email> TEST_USER_PASSWORD=<pass> \
 *     npx playwright test e2e/perf-walkthrough.spec.ts --headed
 *
 * Auth fallback: if env creds are absent, create a confirmed user via the
 * Supabase Admin API (supabase.auth.admin.createUser) and set the vars above.
 *
 * Requires network egress (hits the real Supabase project).
 * Not wired into CI — run locally only.
 */
import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const EMAIL = process.env.TEST_USER_EMAIL ?? ''
const PASSWORD = process.env.TEST_USER_PASSWORD ?? ''

// Soft budget thresholds (ms)
const BUDGETS = {
  tbt: 200,       // Total Blocking Time
  fcp: 3000,      // First Contentful Paint
  lcp: 4000,      // Largest Contentful Paint
  tti: 5000,      // Time to Interactive (approximated)
}

interface PanelPerfResult {
  panel: string
  fcp: number | null
  lcp: number | null
  tbt: number | null
  longTaskCount: number
  consoleErrors: string[]
}

async function measurePanel(page: Page, panel: string): Promise<PanelPerfResult> {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  // Navigate via hash — FEED is a SPA
  await page.goto(`${BASE_URL}/#${panel}`, { waitUntil: 'networkidle' })

  const metrics = await page.evaluate(() => {
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const paintEntries = performance.getEntriesByType('paint')
    const fcp = paintEntries.find((e) => e.name === 'first-contentful-paint')?.startTime ?? null
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
    const lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : null

    // Long tasks (recorded by PerformanceObserver — already accumulated in buffer)
    const longTasks = performance.getEntriesByType('longtask') as PerformanceLongTaskTiming[]
    let tbt = 0
    let longTaskCount = 0
    for (const task of longTasks) {
      if (task.duration > 50) {
        tbt += task.duration - 50
        longTaskCount++
      }
    }

    return { fcp, lcp, tbt: Math.round(tbt), longTaskCount }
  })

  return {
    panel,
    ...metrics,
    consoleErrors: errors,
  }
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  // Wait for redirect back to root SPA
  await page.waitForURL(`${BASE_URL}/**`, { timeout: 15_000 })
}

test.describe('FEED panel perf walkthrough', () => {
  test.skip(!EMAIL || !PASSWORD, 'Set TEST_USER_EMAIL and TEST_USER_PASSWORD to run perf tests')

  test('measures FCP / LCP / TBT across all panels', async ({ page }) => {
    await login(page)

    const panels = ['overview', 'chat', 'feed', 'map', 'applications', 'documents', 'forms']
    const results: PanelPerfResult[] = []

    for (const panel of panels) {
      const result = await measurePanel(page, panel)
      results.push(result)
    }

    // Print results table
    console.table(
      results.map((r) => ({
        Panel: r.panel,
        'FCP (ms)': r.fcp?.toFixed(0) ?? 'n/a',
        'LCP (ms)': r.lcp?.toFixed(0) ?? 'n/a',
        'TBT (ms)': r.tbt?.toFixed(0) ?? 'n/a',
        'Long tasks': r.longTaskCount,
        'Console errors': r.consoleErrors.length,
      }))
    )

    // Soft budget assertions
    for (const r of results) {
      if (r.fcp !== null) {
        expect.soft(r.fcp, `${r.panel}: FCP exceeded ${BUDGETS.fcp}ms`).toBeLessThan(BUDGETS.fcp)
      }
      if (r.lcp !== null) {
        expect.soft(r.lcp, `${r.panel}: LCP exceeded ${BUDGETS.lcp}ms`).toBeLessThan(BUDGETS.lcp)
      }
      if (r.tbt !== null) {
        expect.soft(r.tbt, `${r.panel}: TBT exceeded ${BUDGETS.tbt}ms`).toBeLessThan(BUDGETS.tbt)
      }
      expect.soft(r.consoleErrors, `${r.panel}: unexpected console errors`).toHaveLength(0)
    }
  })
})
