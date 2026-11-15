// apps/web/src/lib/profile-read.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A failed or timed-out own-profile read for the SAME user keeps the profile already loaded (the
// member's language does not fall back to English); a read for another user never keeps the
// previous account's profile. And one auth.profile.read row per finished read.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ logEvent: vi.fn() }))
vi.mock('./logger', () => ({ logEvent: h.logEvent, logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { nextProfileAfterRead, logProfileRead } from './profile-read'
import { resolveProfileLocale } from './i18n'

const loaded = { id: 'u1', full_name: 'A', preferred_language: 'ko' }

describe('nextProfileAfterRead', () => {
  it('a failed re-read for the same user keeps the loaded profile, and the locale stays Korean', () => {
    const next = nextProfileAfterRead(loaded, null, 'u1')
    expect(next).toBe(loaded)
    expect(resolveProfileLocale(next)).toBe('ko')
  })

  it('a successful read replaces the profile', () => {
    const fresh = { id: 'u1', full_name: 'A', preferred_language: 'es' }
    expect(nextProfileAfterRead(loaded, fresh, 'u1')).toBe(fresh)
  })

  it("a failed read for another user never keeps the previous account's profile", () => {
    expect(nextProfileAfterRead(loaded, null, 'u2')).toBeNull()
  })

  it('a failed first read leaves no profile', () => {
    expect(nextProfileAfterRead(null, null, 'u1')).toBeNull()
  })
})

describe('logProfileRead', () => {
  beforeEach(() => h.logEvent.mockClear())

  it('writes one row with trigger, outcome, had_language and a whole-number duration', () => {
    logProfileRead('SIGNED_IN', 'timeout', null, 12000.4)
    logProfileRead('INITIAL_SESSION', 'ok', loaded, 87.6)
    expect(h.logEvent.mock.calls).toEqual([
      ['auth.profile.read', { trigger: 'SIGNED_IN', outcome: 'timeout', had_language: false, duration_ms: 12000 }],
      ['auth.profile.read', { trigger: 'INITIAL_SESSION', outcome: 'ok', had_language: true, duration_ms: 88 }],
    ])
  })
})
