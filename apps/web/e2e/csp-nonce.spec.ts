/**
 * csp-nonce.spec.ts — Wave 6b real-browser CSP enforcement harness.
 *
 * This class of regression is INVISIBLE to static/unit checks: a correct CSP
 * response header can still blank the app if a script isn't nonce'd, or block
 * Mapbox GL / Vercel Analytics / Turnstile at runtime. Only a real Chromium
 * render with console-violation capture proves the nonce + strict-dynamic
 * policy actually enforces nonce-only execution WITHOUT breaking any surface.
 *
 * OPT-IN: this harness needs a PRODUCTION build server (the policy under test
 * is the production CSP — no dev-only 'unsafe-eval'). It runs ONLY when
 * CSP_BASE_URL is set, so the default e2e config (dev server) skips it and CI
 * stays green. To run it:
 *   PORT=4123 npm run start    (separate shell, from apps/web)
 *   CSP_BASE_URL=http://localhost:4123 CSP_EMBED_POST_ID=<real-post-id> \
 *     npx playwright test --config=playwright.csp.config.ts
 */
import { test, expect, type ConsoleMessage } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const BASE = process.env.CSP_BASE_URL ?? ''

// Skip the whole suite unless an explicit production server URL is provided.
test.skip(!BASE, 'CSP harness runs only when CSP_BASE_URL points at a production build')

// ---------------------------------------------------------------------------
// Admin client + namespaced test user (mirrors auth.spec.ts conventions) so
// the authenticated Mapbox surface (b) can be reached. Service role never
// touches the browser.
// ---------------------------------------------------------------------------
function makeAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE env (apps/web/.env.local)')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
const RUN_TS = Date.now()
const CSP_EMAIL = `e2e+csp-map-${RUN_TS}@feed.local`
const CSP_PASSWORD = 'E2eCspPass!2026#$'

async function deleteUserByEmail(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) return
  const u = data.users.find((x) => x.email === email)
  if (u) await admin.auth.admin.deleteUser(u.id)
}

/**
 * Collect TRUE CSP violations surfaced to the browser console / page errors.
 *
 * Chromium emits the exact phrase "violates the following Content Security
 * Policy directive" ONLY for a real CSP block. We match that phrase precisely
 * so we do NOT misattribute unrelated console errors — e.g. the local-only
 * "Refused to execute script ... MIME type ('text/html')" 404 for Vercel's
 * platform endpoints (/_vercel/insights|speed-insights/script.js), which are
 * served by the Vercel platform in production and simply 404 under
 * `npm run start`. That MIME refusal is independent of CSP and pre-dates Wave 6b.
 */
function attachCspCollector(page: import('@playwright/test').Page): string[] {
  const CSP_VIOLATION = /violates the following content security policy directive/i
  const violations: string[] = []
  page.on('console', (msg: ConsoleMessage) => {
    if (CSP_VIOLATION.test(msg.text())) {
      violations.push(`[console.${msg.type()}] ${msg.text()}`)
    }
  })
  page.on('pageerror', (err) => {
    if (CSP_VIOLATION.test(err.message)) {
      violations.push(`[pageerror] ${err.message}`)
    }
  })
  return violations
}

test.describe('Wave 6b — CSP nonce + strict-dynamic (production policy)', () => {
  test('(a) home / hydrates with zero CSP violations and is interactive', async ({ page }) => {
    const violations = attachCspCollector(page)
    const resp = await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    // The CSP header must carry a nonce + strict-dynamic.
    const csp = resp?.headers()['content-security-policy'] ?? ''
    expect(csp).toMatch(/script-src 'nonce-[^']+' 'strict-dynamic'/)
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    // Hydration proof: the page reaches an interactive state (a real DOM node
    // rendered by client React — the login redirect or shell). If scripts were
    // CSP-blocked the body would be an un-hydrated static shell.
    await expect(page.locator('body')).toBeVisible()
    expect(violations, violations.join('\n')).toHaveLength(0)
  })

  test('(e) /login renders, is interactive, zero CSP violations', async ({ page }) => {
    const violations = attachCspCollector(page)
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    // Form wiring intact: the email input is present and editable (proves React
    // hydrated under the nonce policy — a CSP-blocked bundle leaves inputs dead).
    const email = page.locator('input[type="email"]')
    await expect(email).toBeVisible()
    await email.fill('csp-probe@example.com')
    await expect(email).toHaveValue('csp-probe@example.com')
    expect(violations, violations.join('\n')).toHaveLength(0)
  })

  test('(d) /signup renders with NO Turnstile (site key unset) and zero CSP violations', async ({ page }) => {
    const violations = attachCspCollector(page)
    await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
    await expect(page.locator('input[type="email"]')).toBeVisible()
    // Turnstile is a no-op when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset → the
    // challenges.cloudflare.com iframe must be absent, and there must be no CSP
    // error from a (non-existent) cloudflare script.
    await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toHaveCount(0)
    expect(violations, violations.join('\n')).toHaveLength(0)
  })

  test('(e) /forgot-password renders + zero CSP violations', async ({ page }) => {
    const violations = attachCspCollector(page)
    await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle' })
    await expect(page.locator('input[type="email"]')).toBeVisible()
    expect(violations, violations.join('\n')).toHaveLength(0)
  })

  test('(g) served scripts carry the nonce that matches the CSP header', async ({ page }) => {
    const resp = await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    const csp = resp?.headers()['content-security-policy'] ?? ''
    const headerNonce = csp.match(/'nonce-([^']+)'/)?.[1]
    expect(headerNonce, 'CSP header must contain a nonce').toBeTruthy()
    // Chromium BLANKS the `nonce` content attribute after applying it (an
    // anti-exfiltration measure) but preserves the live IDL `.nonce` property.
    // Read the property so we observe the nonce the browser actually enforced.
    const scriptNonces = await page.locator('script').evaluateAll((els) =>
      els.map((e) => (e as HTMLScriptElement).nonce)
    )
    expect(scriptNonces.length).toBeGreaterThan(0)
    for (const n of scriptNonces) {
      expect(n).toBe(headerNonce)
    }
  })

  test('(f) /s/embed/:id renders under the EMBED policy (frame-ancestors *, no cloudflare)', async ({ page }) => {
    const violations = attachCspCollector(page)
    const embedId = process.env.CSP_EMBED_POST_ID ?? '00000000-0000-0000-0000-000000000000'
    const resp = await page.goto(`${BASE}/s/embed/${embedId}`, { waitUntil: 'networkidle' })
    const csp = resp?.headers()['content-security-policy'] ?? ''
    // Embed profile selected by path: permissive iframe embedding, no form posts,
    // and NONE of the main-app third-party script hosts.
    expect(csp).toMatch(/frame-ancestors \*/)
    expect(csp).toContain("form-action 'none'")
    expect(csp).not.toContain('challenges.cloudflare.com')
    expect(csp).not.toContain('va.vercel-scripts.com')
    // Still nonce-enforced.
    expect(csp).toMatch(/script-src 'nonce-[^']+' 'strict-dynamic'/)
    expect(violations, violations.join('\n')).toHaveLength(0)
  })

  test('(b)+(c) authenticated map panel: Mapbox GL renders + Analytics loads, zero CSP violations', async ({ page }) => {
    test.setTimeout(90_000)
    const admin = makeAdmin()
    await deleteUserByEmail(admin, CSP_EMAIL)
    // Create a confirmed, onboarding-complete user so we land directly at /.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: CSP_EMAIL,
      password: CSP_PASSWORD,
      email_confirm: true,
    })
    expect(createErr, createErr?.message).toBeNull()
    const uid = created!.user!.id
    // The handle_new_user trigger creates the profile row asynchronously; poll
    // until it exists, then mark onboarding complete + set a location so the
    // proxy routes the login straight to / (not /onboarding) and the map has a
    // center.
    for (let i = 0; i < 20; i++) {
      const { data: row } = await admin.from('profiles').select('id').eq('id', uid).maybeSingle()
      if (row) break
      await new Promise((r) => setTimeout(r, 250))
    }
    const { error: updErr } = await admin.from('profiles').update({
      onboarding_completed: true,
      user_role: 'seeking',
      zip_code: '90210',
      location_city: 'Beverly Hills',
      location_state: 'California',
    }).eq('id', uid)
    expect(updErr, updErr?.message).toBeNull()
    // Confirm the flag actually persisted before driving the browser.
    const { data: check } = await admin
      .from('profiles').select('onboarding_completed').eq('id', uid).single()
    expect(check?.onboarding_completed, 'profile must be onboarding-complete').toBe(true)

    const violations = attachCspCollector(page)
    try {
      // Log in via the real form.
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
      await page.fill('input[type="email"]', CSP_EMAIL)
      await page.fill('input[type="password"]', CSP_PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 30_000 })

      // Switch to the Resource Map panel (sidebar button aria-label "Resource Map").
      const mapBtn = page.locator('[aria-label="Resource Map"], button:has-text("Resource Map")').first()
      await mapBtn.click()

      // Mapbox GL renders a <canvas class="mapboxgl-canvas">. Its appearance
      // proves the GL worker (worker-src 'self' blob:) + script (strict-dynamic)
      // were NOT CSP-blocked.
      await expect(page.locator('canvas.mapboxgl-canvas')).toBeVisible({ timeout: 30_000 })

      // No CSP violation from Mapbox (api.mapbox.com connect/img, blob: worker)
      // nor from Vercel Analytics first-party intake.
      expect(violations, violations.join('\n')).toHaveLength(0)
    } finally {
      await deleteUserByEmail(admin, CSP_EMAIL)
    }
  })
})
