// apps/web/src/lib/follow-gate.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Unit tests for resolveFollowGate — the pure decision behind the Follow affordance on both
// the PostCard header and the author profile sheet. The load-bearing invariant (round-2
// MEDIUM): a guest resolves to 'guest-prompt' (which routes a tap to CreateAccountPrompt and
// attempts NO follows insert), a signed-in non-guest resolves to 'active', and self / signed
// out / unwired resolve to 'hidden'. Cases are chosen to kill single-clause mutations.

import { describe, it, expect } from 'vitest'
import { resolveFollowGate } from './follow-gate'

const base = { currentUserId: 'viewer-1', authorId: 'author-1', isGuest: false, hasHandlers: true }

describe('resolveFollowGate', () => {
  it('active — signed-in non-guest viewing another author', () => {
    expect(resolveFollowGate(base)).toBe('active')
  })

  it('guest-prompt — a guest viewing another author (never attempts an insert)', () => {
    expect(resolveFollowGate({ ...base, isGuest: true })).toBe('guest-prompt')
  })

  it('hidden — signed out (currentUserId null)', () => {
    expect(resolveFollowGate({ ...base, currentUserId: null })).toBe('hidden')
  })

  it('hidden — signed out wins over the guest flag (null check precedes guest check)', () => {
    expect(resolveFollowGate({ ...base, currentUserId: null, isGuest: true })).toBe('hidden')
  })

  it('hidden — viewing self as a non-guest', () => {
    expect(resolveFollowGate({ ...base, currentUserId: 'author-1' })).toBe('hidden')
  })

  it('hidden — viewing self wins over the guest flag (self check precedes guest check)', () => {
    expect(resolveFollowGate({ ...base, currentUserId: 'author-1', isGuest: true })).toBe('hidden')
  })

  it('hidden — follow handlers not wired', () => {
    expect(resolveFollowGate({ ...base, hasHandlers: false })).toBe('hidden')
  })

  it('hidden — handlers missing wins over the guest flag', () => {
    expect(resolveFollowGate({ ...base, isGuest: true, hasHandlers: false })).toBe('hidden')
  })
})
