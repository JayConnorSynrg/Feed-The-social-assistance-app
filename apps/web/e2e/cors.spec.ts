/**
 * cors.spec.ts — Browser-origin CORS regression guard for 4 browser-facing edge functions.
 *
 * Root cause fixed: the apex origin https://sourcetofeed.com was in ALLOWED_ORIGINS via
 * APP_URL, but the browser sends https://www.sourcetofeed.com (apex 307→www redirect).
 * getCorsHeaders returned the apex origin → browser CORS-blocked every call.
 *
 * APP_URL was intentionally NOT changed: it doubles as the ActivityPub federation keyId
 * (${APP_URL}#main-key in federation-sync/federation-inbox); changing it corrupts federation
 * signatures. The fix is an additive www entry in ALLOWED_ORIGINS.
 *
 * This spec sends an OPTIONS preflight with Origin: https://www.sourcetofeed.com and asserts
 * that Access-Control-Allow-Origin echoes back https://www.sourcetofeed.com — exactly what
 * a browser sends and expects.
 *
 * CI: runs against deployed functions. Requires NEXT_PUBLIC_SUPABASE_URL in env.
 * Local: set NEXT_PUBLIC_SUPABASE_URL (auto-loaded from apps/web/.env.local by playwright.config.ts).
 */

import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Derive the functions base URL from the Supabase project URL.
// Pattern: https://<ref>.supabase.co/functions/v1
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

test.skip(!SUPABASE_URL, 'cors.spec.ts requires NEXT_PUBLIC_SUPABASE_URL')

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`

// The origin that must be allowed — the canonical browser-facing origin.
const WWW_ORIGIN = 'https://www.sourcetofeed.com'

// The 4 browser-facing edge functions patched in this fix.
const BROWSER_FACING_FUNCTIONS = ['chat', 'benefits-screening', 'validate-password', 'auth-guard']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Send an HTTP OPTIONS preflight for the given function URL with the www origin.
 * Returns the response headers as a plain object (lowercased keys).
 */
async function sendPreflight(request: import('@playwright/test').APIRequestContext, fnUrl: string) {
  const response = await request.fetch(fnUrl, {
    method: 'OPTIONS',
    headers: {
      Origin: WWW_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization, content-type',
    },
  })
  return { status: response.status(), headers: response.headers() }
}

// ---------------------------------------------------------------------------
// Tests — one per function so failures are individually identifiable.
// ---------------------------------------------------------------------------

for (const fnName of BROWSER_FACING_FUNCTIONS) {
  test(`OPTIONS preflight: ${fnName} returns ACAO: ${WWW_ORIGIN}`, async ({ request }) => {
    const url = `${FUNCTIONS_BASE}/${fnName}`
    const { status, headers } = await sendPreflight(request, url)

    // A 200 or 204 is the expected preflight success status.
    // Some Supabase function deployments return 200 for OPTIONS, others 204.
    expect(
      [200, 204],
      `${fnName}: expected OPTIONS to return 200 or 204, got ${status}`
    ).toContain(status)

    const acao = headers['access-control-allow-origin']
    expect(
      acao,
      `${fnName}: Access-Control-Allow-Origin should be "${WWW_ORIGIN}" (www origin), got "${acao}". ` +
      `This is the browser-origin CORS regression guard — if this fails the www origin is not in ` +
      `ALLOWED_ORIGINS and every browser call from https://www.sourcetofeed.com will be CORS-blocked.`
    ).toBe(WWW_ORIGIN)
  })
}

// ---------------------------------------------------------------------------
// Apex origin should still work (regression: don't break existing callers).
// ---------------------------------------------------------------------------

test('OPTIONS preflight: chat returns ACAO for apex origin', async ({ request }) => {
  const url = `${FUNCTIONS_BASE}/chat`
  // Apex origin is in ALLOWED_ORIGINS via APP_URL env var (set to https://sourcetofeed.com).
  // It must continue to work after the www addition.
  const APEX_ORIGIN = 'https://sourcetofeed.com'
  const response = await request.fetch(url, {
    method: 'OPTIONS',
    headers: {
      Origin: APEX_ORIGIN,
      'Access-Control-Request-Method': 'POST',
    },
  })
  const acao = response.headers()['access-control-allow-origin']
  // The apex is in ALLOWED_ORIGINS (via APP_URL), so it should echo back.
  expect(
    acao,
    `chat: apex origin should still be echoed back after www addition, got "${acao}"`
  ).toBe(APEX_ORIGIN)
})
