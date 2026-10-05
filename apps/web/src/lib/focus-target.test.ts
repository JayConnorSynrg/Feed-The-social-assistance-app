// focus-target.test.ts — the single focus-placement rule used by every error fallback.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { focusWithin } from './focus-target'
import { fakeEl, asEl } from './__tests__/fake-dom'

beforeEach(() => {
  vi.stubGlobal('document', { activeElement: null })
})
afterEach(() => vi.unstubAllGlobals())

describe('focusWithin', () => {
  it('prefers a still-mounted preferred element (e.g. a re-shown error message)', () => {
    const msg = fakeEl('msg', { tabindex: '-1' })
    const host = fakeEl('host', { h1: fakeEl('h1') })
    expect(focusWithin(asEl(host), asEl(msg))).toBe(msg)
    expect(msg.focusCalls).toHaveLength(1)
    expect(host.focusCalls).toHaveLength(0)
  })

  it('preferred unmounted -> the host first h1, made focusable with a temporary tabindex', () => {
    const h1 = fakeEl('h1')
    const host = fakeEl('host', { h1 })
    expect(focusWithin(asEl(host), asEl(fakeEl('msg', { connected: false })))).toBe(h1)
    expect(h1.attrs.get('tabindex')).toBe('-1')
    expect(h1.focusCalls).toEqual([undefined]) // scrolls into view normally
    h1.blurHandlers.forEach((h) => h())
    expect(h1.attrs.has('tabindex')).toBe(false)
  })

  it('an h1 that already has a tabindex keeps it', () => {
    const h1 = fakeEl('h1', { tabindex: '-1' })
    focusWithin(asEl(fakeEl('host', { h1 })))
    expect(h1.blurHandlers).toHaveLength(0)
    expect(h1.attrs.get('tabindex')).toBe('-1')
  })

  it('no h1 -> the host itself, temporary tabindex, without scrolling', () => {
    const host = fakeEl('host')
    expect(focusWithin(asEl(host))).toBe(host)
    expect(host.focusCalls).toEqual([{ preventScroll: true }])
    expect(host.attrs.get('tabindex')).toBe('-1')
  })

  it('focus does not take: the temporary tabindex is removed at once', () => {
    const h1 = fakeEl('h1', { takesFocus: false })
    expect(focusWithin(asEl(fakeEl('host', { h1 })))).toBeNull()
    expect(h1.focusCalls).toHaveLength(1)
    expect(h1.attrs.has('tabindex')).toBe(false)
  })

  it('focus does not take on an element with its own tabindex: that tabindex is kept', () => {
    const h1 = fakeEl('h1', { tabindex: '0', takesFocus: false })
    focusWithin(asEl(fakeEl('host', { h1 })))
    expect(h1.attrs.get('tabindex')).toBe('0')
  })

  it('no host -> nothing', () => {
    expect(focusWithin(null)).toBeNull()
  })
})
