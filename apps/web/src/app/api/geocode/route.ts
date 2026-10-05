// apps/web/src/app/api/geocode/route.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// POST /api/geocode {street, city, state, zip} -> {match:'exact'|'non_exact'|'none', lat, lng,
// matched_address}. Signed-in, non-guest users only (401 / 403), rate limited per user and per
// client IP, then ONE server-side call to the US Census Geocoder (8 s timeout). The answer is a
// draft pin: the admin form shows it on a map and a person confirms or drags it before saving.
// Logs geocode.resolve {outcome, source:'census'} — never the address text.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logEvent } from '@/lib/logger'
import { extractClientIp, rateLimiter } from '@/middleware/federation-rate-limit'
import {
  CENSUS_BATCH_URL,
  CENSUS_BENCHMARK,
  buildBatchCsv,
  parseBatchResponse,
  parseGeocodeBody,
} from '@/lib/census-geocode'

const GEOCODE_TIMEOUT_MS = 8_000

type Outcome = 'exact' | 'non_exact' | 'none' | 'timeout' | 'upstream_error' | 'rate_limited' | 'invalid'

function resolveLog(outcome: Outcome): void {
  logEvent('geocode.resolve', { outcome, source: 'census' })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (user.is_anonymous) return NextResponse.json({ error: 'account_required' }, { status: 403 })

  const byUser = rateLimiter.checkLimit(`user:${user.id}`, 'geocode')
  const byIp = rateLimiter.checkLimit(`ip:${extractClientIp(req)}`, 'geocode')
  if (!byUser.allowed || !byIp.allowed) {
    resolveLog('rate_limited')
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = null
  }
  const input = parseGeocodeBody(body)
  if (!input) {
    resolveLog('invalid')
    return NextResponse.json({ error: 'street_required' }, { status: 400 })
  }

  const form = new FormData()
  form.append('benchmark', CENSUS_BENCHMARK)
  form.append('addressFile', new Blob([buildBatchCsv(input)], { type: 'text/csv' }), 'address.csv')

  try {
    const res = await fetch(CENSUS_BATCH_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!res.ok) {
      resolveLog('upstream_error')
      return NextResponse.json({ error: 'geocoder_unavailable' }, { status: 502 })
    }
    const result = parseBatchResponse(await res.text())
    resolveLog(result.match)
    return NextResponse.json(result)
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
    resolveLog(timedOut ? 'timeout' : 'upstream_error')
    return NextResponse.json({ error: timedOut ? 'geocoder_timeout' : 'geocoder_unavailable' }, { status: timedOut ? 504 : 502 })
  }
}
