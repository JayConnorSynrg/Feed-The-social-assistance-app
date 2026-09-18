// supabase/functions/_shared/discovery-pipeline.test.ts
//
// Deno unit tests for the resource-discover pure pipeline. Each test asserts an
// OUTCOME an operator observes; the ones marked "mutation-proof" go RED if the
// guard they cover is removed (see the PR body for the RED-on-break evidence).
//
// Run:  deno test supabase/functions/_shared/discovery-pipeline.test.ts

import {
  assert,
  assertEquals,
  assertNotMatch,
} from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  checkUrlLiveness,
  classifyOutcome,
  fetchWithRetry,
  isRetryableStatus,
  normalizeUrlForDedup,
  isDuplicateUrl,
  parseRetryAfterMs,
  scoreHost,
  sourceCandidates,
  verify,
  type AgentResult,
  type FetchLike,
} from './discovery-pipeline.ts'

const mkResult = (n: number, forms = 0): AgentResult => ({
  resources: Array.from({ length: n }, (_, i) => ({ name: `R${i}`, sources: [`https://x${i}.org`] })),
  forms: Array.from({ length: forms }, (_, i) => ({ name: `F${i}`, sources: [`https://f${i}.gov`] })),
  via: 'search',
})

// ── helper: fake Response with headers.get('retry-after') ──
function fakeResp(status: number, retryAfter?: string): Response {
  const headers = new Headers()
  if (retryAfter) headers.set('retry-after', retryAfter)
  return new Response(null, { status, headers })
}

// ═══════════════════════════════════════════════════════════
// INV-0a — no self-collision: search PRIMARY, agent SEQUENTIAL, never overlap
// ═══════════════════════════════════════════════════════════

Deno.test('INV-0a: agent times out → run still returns >=1 candidate via search, and NO overlap (mutation-proof)', async () => {
  let active = 0
  let maxConcurrency = 0
  const track = async <T>(fn: () => Promise<T>): Promise<T> => {
    active++
    maxConcurrency = Math.max(maxConcurrency, active)
    try {
      await new Promise((r) => setTimeout(r, 5)) // hold the "slot" briefly
      return await fn()
    } finally {
      active--
    }
  }

  const outcome = await sourceCandidates({
    // search returns exactly 1 (below enrich threshold) so agent ALSO runs → overlap is observable if it existed
    runSearch: () => track(async () => ({ result: mkResult(1), rateLimited: false })),
    // agent "times out" → resolves null
    runAgent: () => track(async () => ({ result: null, rateLimited: false })),
  })

  assert(outcome.agentRan, 'agent should run as enrichment when search under-delivers')
  assertEquals(outcome.result?.resources.length, 1, 'search candidate survives the agent timeout')
  assertEquals(maxConcurrency, 1, 'search and agent must never be in flight at the same instant')
})

Deno.test('INV-0a: search over-delivers → agent skipped entirely (no needless second slot)', async () => {
  let agentCalled = false
  const outcome = await sourceCandidates({
    runSearch: () => Promise.resolve({ result: mkResult(5), rateLimited: false }),
    runAgent: () => {
      agentCalled = true
      return Promise.resolve({ result: mkResult(2), rateLimited: false })
    },
    enrichThreshold: 3,
  })
  assertEquals(agentCalled, false, 'agent must not fire when search already met the threshold')
  assertEquals(outcome.result?.resources.length, 5)
})

// ═══════════════════════════════════════════════════════════
// INV-0b — transient limits retried, not fatal
// ═══════════════════════════════════════════════════════════

Deno.test('INV-0b: a 429 with Retry-After triggers exactly one backoff+retry that then succeeds', async () => {
  const slept: number[] = []
  const responses = [fakeResp(429, '1'), fakeResp(200)]
  let i = 0
  const resp = await fetchWithRetry(() => Promise.resolve(responses[i++]), {
    sleep: (ms) => { slept.push(ms); return Promise.resolve() },
    jitter: () => 0,
    baseDelayMs: 100,
    maxRetries: 3,
    maxBudgetMs: 60_000,
  })
  assertEquals(resp.status, 200, 'retry recovers the run')
  assertEquals(slept.length, 1, 'exactly one backoff before the successful retry')
  assertEquals(slept[0], 1000, 'Retry-After: 1s (1000ms) is honored over the 100ms base backoff')
})

Deno.test('INV-0b: a 400 does NOT retry (4xx-other is terminal)', async () => {
  let calls = 0
  const resp = await fetchWithRetry(() => { calls++; return Promise.resolve(fakeResp(400)) }, {
    sleep: () => Promise.resolve(),
    jitter: () => 0,
  })
  assertEquals(resp.status, 400)
  assertEquals(calls, 1, '400 is not retried')
})

Deno.test('INV-0b: isRetryableStatus / parseRetryAfterMs primitives', () => {
  assert(isRetryableStatus(429))
  assert(isRetryableStatus(503))
  assert(!isRetryableStatus(404))
  assert(!isRetryableStatus(200))
  // Retry-After wins only when larger than the exponential backoff
  assertEquals(parseRetryAfterMs('2', 0, 100, 0), 2000)
  assertEquals(parseRetryAfterMs(null, 2, 100, 0), 400) // 100 * 2^2
})

// ═══════════════════════════════════════════════════════════
// INV-0c — honest admin signal: three distinct states, no "Sourcing failed"
// ═══════════════════════════════════════════════════════════

Deno.test('INV-0c: three fixtures map to candidates / clean-empty / rate-limited', () => {
  const candidates = classifyOutcome({ result: mkResult(2), rateLimited: false })
  assertEquals(candidates.state, 'candidates')
  assertEquals(candidates.status, 200)

  const empty = classifyOutcome({ result: mkResult(0), rateLimited: false })
  assertEquals(empty.state, 'empty')
  assertEquals(empty.status, 200)
  assert(/no results/i.test(empty.message), 'clean empty is a "no results", not an error')

  const limited = classifyOutcome({ result: null, rateLimited: true })
  assertEquals(limited.state, 'rate_limited')
  assertEquals(limited.status, 503)
  assert(/rate-limited/i.test(limited.message))
})

Deno.test('INV-0c: regression guard — no admin-facing message contains "Sourcing failed"', () => {
  for (const o of [
    classifyOutcome({ result: mkResult(1), rateLimited: false }),
    classifyOutcome({ result: mkResult(0), rateLimited: false }),
    classifyOutcome({ result: null, rateLimited: true }),
  ]) {
    assertNotMatch(o.message, /Sourcing failed/)
  }
})

// ═══════════════════════════════════════════════════════════
// INV-2a — liveness
// ═══════════════════════════════════════════════════════════

Deno.test('INV-2a: vtfoodbank 404 fixture is dropped; 200 fixture passes (mutation-proof)', async () => {
  const dead = 'https://www.vtfoodbank.org/get-help/find-food'
  const live = 'https://www.vtfoodbank.org/access-food/find-a-food-shelf/'
  const fetchLike: FetchLike = (input) =>
    Promise.resolve(input === dead
      ? { ok: false, status: 404, url: dead }
      : { ok: true, status: 200, url: live })

  const deadRes = await checkUrlLiveness(dead, fetchLike)
  assertEquals(deadRes.ok, false)
  assertEquals(deadRes.reason, 'not_found')

  const liveRes = await checkUrlLiveness(live, fetchLike)
  assertEquals(liveRes.ok, true)
  assertEquals(liveRes.reason, 'ok')
})

Deno.test('INV-2a: authoritative-pass fixtures resolve live', async () => {
  const fetchLike: FetchLike = (input) => Promise.resolve({ ok: true, status: 200, url: input })
  for (const u of ['https://dcf.vermont.gov/benefits/fuel', 'https://www.broc.org', 'https://rhavt.org']) {
    const r = await checkUrlLiveness(u, fetchLike)
    assertEquals(r.ok, true, `${u} should pass liveness`)
  }
})

Deno.test('INV-2a: cross-host redirect fails (not the same org)', async () => {
  const u = 'https://example.org/help'
  const fetchLike: FetchLike = () => Promise.resolve({ ok: true, status: 200, url: 'https://spammer.com/landing' })
  const r = await checkUrlLiveness(u, fetchLike)
  assertEquals(r.ok, false)
  assertEquals(r.reason, 'cross_host_redirect')
})

Deno.test('INV-2a: HEAD unsupported (405) falls back to ranged GET', async () => {
  const u = 'https://rhavt.org/apply'
  const calls: string[] = []
  const fetchLike: FetchLike = (input, init) => {
    calls.push(init?.method ?? 'GET')
    return Promise.resolve(init?.method === 'HEAD'
      ? { ok: false, status: 405, url: input }
      : { ok: true, status: 200, url: input })
  }
  const r = await checkUrlLiveness(u, fetchLike)
  assertEquals(r.ok, true)
  assertEquals(calls, ['HEAD', 'GET'])
})

// ═══════════════════════════════════════════════════════════
// INV-2b — authoritative-domain priority
// ═══════════════════════════════════════════════════════════

Deno.test('INV-2b: a .gov ranks above a generic domain', () => {
  assert(scoreHost('dcf.vermont.gov') > scoreHost('someshelter.com'))
  assert(scoreHost('benefits.gov') > scoreHost('example.net'))
  // civic + nonprofit tiers sit between .gov and generic
  assert(scoreHost('search.vermont211.org') > scoreHost('foo.org'))
  assert(scoreHost('foo.org') > scoreHost('foo.com'))
})

Deno.test('INV-2b: verify() writes confidence reflecting authoritativeness', () => {
  const gov = verify('q', ['https://dcf.vermont.gov/x'])
  assertEquals(gov?.confidence, 'medium') // authoritative single-source
  assert(gov?.authoritative_domain)

  const twoAuth = verify('q', ['https://a.gov/x', 'https://b.org/y'])
  assertEquals(twoAuth?.confidence, 'high') // authoritative + corroborated

  const genericSingle = verify('q', ['https://shelter.com/x'])
  assertEquals(genericSingle?.confidence, 'low')
  assertEquals(genericSingle?.flagged_for_review, true) // visible but not credible
})

Deno.test('INV-2c: authoritative single-source is never dropped; unusable no-host is dropped', () => {
  assert(verify('q', ['https://rhavt.org/help']) !== null, 'authoritative single-source stays')
  assert(verify('q', ['not-a-url', '   ']) === null, 'no citable host → drop')
})

// ═══════════════════════════════════════════════════════════
// INV-2d — dedup
// ═══════════════════════════════════════════════════════════

Deno.test('INV-2d: a candidate whose normalized URL already exists is deduped', () => {
  const existing = new Set<string>([
    normalizeUrlForDedup('https://www.rhavt.org/')!,
  ])
  // trailing slash, www, utm noise, case — all normalize to the same key
  assert(isDuplicateUrl('https://RHAVT.org/?utm_source=email', existing))
  assert(isDuplicateUrl('http://www.rhavt.org', new Set([normalizeUrlForDedup('https://rhavt.org')!])) === false,
    'scheme differs → protocol kept, so this is NOT a dup (documents current behavior)')
  assert(!isDuplicateUrl('https://vtfoodbank.org/find', existing), 'different org is not a dup')
})

Deno.test('INV-2d: normalizeUrlForDedup strips www, trailing slash, and utm noise', () => {
  assertEquals(
    normalizeUrlForDedup('https://www.Example.org/Help/?utm_medium=x&gclid=1'),
    'https://example.org/help',
  )
  assertEquals(normalizeUrlForDedup('bad'), null)
})
