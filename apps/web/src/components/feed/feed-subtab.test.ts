import { describe, it, expect } from 'vitest'
import { resolveFeedSubtab } from './feed-subtab'

describe('resolveFeedSubtab', () => {
  // Each explicit branch is asserted independently so a mutation that collapses
  // any one branch into another (or into the default) fails exactly one case.
  it('resolves "messages"', () => {
    expect(resolveFeedSubtab('messages')).toBe('messages')
  })

  it('resolves "events"', () => {
    expect(resolveFeedSubtab('events')).toBe('events')
  })

  it('resolves "petitions"', () => {
    expect(resolveFeedSubtab('petitions')).toBe('petitions')
  })

  it('defaults to "feed" for the explicit "feed" value', () => {
    expect(resolveFeedSubtab('feed')).toBe('feed')
  })

  // The return-to-feed fix depends on a cleared (undefined) subtab resolving to
  // 'feed'. Guards the defect where a stale 'events'/'petitions' subtab kept the
  // Feed button from switching back.
  it('defaults to "feed" when the subtab param is cleared (undefined)', () => {
    expect(resolveFeedSubtab(undefined)).toBe('feed')
  })

  it('defaults to "feed" for null', () => {
    expect(resolveFeedSubtab(null)).toBe('feed')
  })

  it('defaults to "feed" for an unrecognized string', () => {
    expect(resolveFeedSubtab('applications')).toBe('feed')
  })

  it('defaults to "feed" for a non-string value', () => {
    expect(resolveFeedSubtab(42)).toBe('feed')
  })
})
