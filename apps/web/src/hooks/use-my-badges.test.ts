// apps/web/src/hooks/use-my-badges.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Tests the data-loading core of useMyBadges. The repo's vitest runs in the
// `node` environment with no React hook renderer (no testing-library /
// react-test-renderer / jsdom), so — exactly like vault-unlock-timeout.test.ts
// tests unlockVault rather than a component — the hook's fetch/decision logic is
// extracted into loadMyBadges() and exercised here with a mocked Supabase
// client. The hook body is a thin state wrapper: it sets summary/privateSummary/
// error from loadMyBadges' result and always clears loading in `finally`, and
// `reload` simply re-invokes this same load. The invariant under test:
// a timeout (or any failure) resolves with `error` set and null summaries, so
// the card never shows "No badges yet" on a failed read.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: h.error, debug: vi.fn() },
}))

import { loadMyBadges, BADGES_TIMEOUT_MESSAGE } from './use-my-badges'
import type { BadgeSummary } from '@/lib/engagement-badges'

// ---------------------------------------------------------------------------
// Mock Supabase client factory
// Each table's terminal .maybeSingle() resolves with the caller-provided result
// (PostgREST RESOLVES — never throws — on abort/timeout; the code path keys on
// the returned error object, mirroring the real client).
// ---------------------------------------------------------------------------
type SingleResult = { data: unknown; error: unknown }

function makeClient(results: Record<string, SingleResult>) {
  const fromCalls: string[] = []
  const client = {
    fromCalls,
    from(table: string) {
      fromCalls.push(table)
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.eq = () => builder
      builder.abortSignal = () => builder
      builder.maybeSingle = async () => results[table] ?? { data: null, error: null }
      return builder
    },
  }
  // Cast through unknown — the mock only implements the surface loadMyBadges uses.
  return client as unknown as Parameters<typeof loadMyBadges>[0] & { fromCalls: string[] }
}

const PUBLIC_SUMMARY: BadgeSummary = {
  families: { food: { level: 2 } },
  badges: { helper: { level: 1 } },
}

describe('loadMyBadges', () => {
  beforeEach(() => {
    h.error.mockClear()
  })

  it('(1) both reads succeed with no private row → summaries resolved, no error', async () => {
    const client = makeClient({
      profiles: { data: { badge_summary: PUBLIC_SUMMARY }, error: null },
      // .maybeSingle() with no row returns data: null (owner has no private badges yet)
      user_private_badge_summary: { data: null, error: null },
    })

    const result = await loadMyBadges(client, 'user-1')

    expect(result.error).toBeNull()
    expect(result.summary).toEqual(PUBLIC_SUMMARY)
    expect(result.privateSummary).toBeNull()
    // Both surfaces were read for the caller's own id.
    expect(client.fromCalls).toContain('profiles')
    expect(client.fromCalls).toContain('user_private_badge_summary')
    expect(h.error).not.toHaveBeenCalled()
  })

  it('(2) a timeout sets the error message (never the empty state) with null summaries', async () => {
    // PostgREST resolves on abort with a TimeoutError-shaped error (code '').
    const client = makeClient({
      profiles: {
        data: null,
        error: { message: 'TimeoutError: The operation was aborted due to timeout', code: '' },
      },
      user_private_badge_summary: { data: null, error: null },
    })

    const result = await loadMyBadges(client, 'user-1')

    expect(result.error).toBe(BADGES_TIMEOUT_MESSAGE)
    expect(result.summary).toBeNull()
    expect(result.privateSummary).toBeNull()
  })

  it('(3) a real (non-timeout) error sets an error message and logs it', async () => {
    const client = makeClient({
      profiles: { data: null, error: { message: 'permission denied for table profiles', code: '42501' } },
      user_private_badge_summary: { data: null, error: null },
    })

    const result = await loadMyBadges(client, 'user-1')

    expect(result.error).toBeTruthy()
    expect(result.error).not.toBe(BADGES_TIMEOUT_MESSAGE)
    expect(result.summary).toBeNull()
    expect(h.error).toHaveBeenCalledWith('my_badges_fetch_failed', expect.any(Object))
  })

  it('(4) reload re-runs the load — a second call reads the DB again', async () => {
    const client = makeClient({
      profiles: { data: { badge_summary: PUBLIC_SUMMARY }, error: null },
      user_private_badge_summary: { data: null, error: null },
    })

    await loadMyBadges(client, 'user-1')
    const callsAfterFirst = client.fromCalls.length
    // reload() in the hook just re-invokes loadMyBadges via the effect.
    const second = await loadMyBadges(client, 'user-1')

    expect(client.fromCalls.length).toBeGreaterThan(callsAfterFirst)
    expect(second.error).toBeNull()
    expect(second.summary).toEqual(PUBLIC_SUMMARY)
  })
})
