// 22-cors-preflight.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 22 — CORS Preflight Regression Guard
// Surface: supabase/functions/_shared/cors.ts → resource-discover, chat
// Upstream: PR #158 added x-request-id to browser fetch headers
// Downstream: Admin Discover panel, Chat panel
//
// Regression guard for the 2026-07-03 x-request-id CORS preflight bug —
// asserts every browser-custom-header the client sends is in the edge allow-list.
// NOTE: this test asserts the DEPLOYED functions; it will FAIL until the edge
// functions are redeployed with the cors.ts fix — that is expected and correct
// (it serves as the post-deploy verification gate).

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Skip guard — no PAT needed; URL must be present for a meaningful assertion.
// ---------------------------------------------------------------------------

function getSupabaseUrl(): string | null {
  // 1. Standard public env var (set in .env.local for local runs, CI sets it directly)
  const fromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (fromEnv && fromEnv.startsWith('https://')) return fromEnv.replace(/\/$/, '')

  // 2. Derive from project ref if only the ref is available
  const ref = process.env.SUPABASE_PROJECT_REF
  if (ref) return `https://${ref}.supabase.co`

  return null
}

const supabaseUrl = getSupabaseUrl()
const skip = supabaseUrl === null
const maybeDescribe = skip ? describe.skip : describe

// ---------------------------------------------------------------------------
// Helper: issue a CORS preflight and return the response headers.
// ---------------------------------------------------------------------------

async function preflight(
  url: string,
  requestedHeader: string,
): Promise<Headers> {
  const res = await fetch(url, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://www.sourcetofeed.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': requestedHeader,
    },
  })
  return res.headers
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

maybeDescribe('22 — CORS preflight regression guard (DEPLOYED edge functions)', () => {
  const functions = ['resource-discover', 'chat'] as const

  for (const fn of functions) {
    it(`${fn}: OPTIONS preflight allows x-request-id in Access-Control-Allow-Headers`, async () => {
      // Surface: browser client adds x-request-id (PR #158); edge must echo it back.
      // Probe: OPTIONS /functions/v1/<fn> with Access-Control-Request-Headers: x-request-id
      const url = `${supabaseUrl}/functions/v1/${fn}`
      const headers = await preflight(url, 'x-request-id')

      const allowHeaders = headers.get('access-control-allow-headers') ?? ''
      expect(
        allowHeaders.toLowerCase(),
        `${fn}: Access-Control-Allow-Headers must include x-request-id.\n` +
        `Got: "${allowHeaders}"\n` +
        `If this fails on a freshly-deployed function, cors.ts was not yet deployed.`,
      ).toContain('x-request-id')
    })
  }

  it('resource-discover: OPTIONS preflight allows content-type (sanity baseline)', async () => {
    // Baseline: content-type was always allowed — if this fails, CORS is broken broadly.
    const url = `${supabaseUrl}/functions/v1/resource-discover`
    const headers = await preflight(url, 'content-type')
    const allowHeaders = headers.get('access-control-allow-headers') ?? ''
    expect(allowHeaders.toLowerCase()).toContain('content-type')
  })
})
