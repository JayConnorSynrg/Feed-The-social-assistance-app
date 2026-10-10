// apps/web/src/components/feed/feed-chrome.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The feed's status region speaks only once the viewer's language has settled
// (useProfileLocale reads 'en' until the profile loads): mounted empty, then one announcement, in
// the settled language — never English first and the member's language second. Driven with the
// mini hook runtime through a harness that renders the region exactly as FeedPanel does.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

import { mount } from '@/test/mini-react'
import { feedLocaleSettled, feedStatusAnnouncement, useFeedAnnounceReady } from './feed-chrome'
import type { Locale } from '@/lib/i18n'

const frames: Array<() => void> = []
const g = globalThis as unknown as { requestAnimationFrame?: unknown; cancelAnimationFrame?: unknown }
beforeEach(() => {
  frames.length = 0
  g.requestAnimationFrame = (cb: () => void) => frames.push(cb)
  g.cancelAnimationFrame = () => {}
})
afterEach(() => {
  delete g.requestAnimationFrame
  delete g.cancelAnimationFrame
})
const nextFrame = () => frames.splice(0).forEach((f) => f())

describe('feedLocaleSettled', () => {
  it.each([
    [{ authLoading: true, user: null, profileSettled: false }, false],
    [{ authLoading: false, user: null, profileSettled: false }, true],
    [{ authLoading: false, user: { id: 'u' }, profileSettled: false }, false],
    [{ authLoading: false, user: { id: 'u' }, profileSettled: true }, true],
  ])('%j → %s', (state, want) => {
    expect(feedLocaleSettled(state)).toBe(want)
  })
})

describe('the feed status region waits for the settled language', () => {
  it('a Spanish member: empty while the profile loads, then "Cargando publicaciones…" once — never English', () => {
    const input = { authLoading: true, user: { id: 'u' } as unknown, profileSettled: false, locale: 'en' as Locale }
    const said: string[] = []
    const m = mount(() => {
      const ready = useFeedAnnounceReady(feedLocaleSettled(input))
      return ready ? feedStatusAnnouncement({ loading: true, error: false, empty: true, notice: '' }, input.locale) : ''
    })
    const record = () => said.push(m.tree())
    record()
    nextFrame()
    m.rerender()
    record()
    // Auth resolved, profile still loading: the locale still reads 'en'.
    input.authLoading = false
    m.rerender()
    nextFrame()
    m.rerender()
    record()
    // The profile arrives: Spanish.
    input.profileSettled = true
    input.locale = 'es'
    m.rerender()
    record()
    nextFrame()
    m.rerender()
    record()
    expect(said).toEqual(['', '', '', '', 'Cargando publicaciones…'])
    expect(said.filter(Boolean)).toHaveLength(1)
  })

  it('the profile read failed (or timed out): the language stays English — announced once, in English, not never', () => {
    const input = { authLoading: false, user: { id: 'u' } as unknown, profileSettled: false, locale: 'en' as Locale }
    const said: string[] = []
    const m = mount(() => {
      const ready = useFeedAnnounceReady(feedLocaleSettled(input))
      return ready ? feedStatusAnnouncement({ loading: true, error: false, empty: true, notice: '' }, input.locale) : ''
    })
    said.push(m.tree())
    nextFrame()
    m.rerender()
    said.push(m.tree())
    // The read ends without a profile (profile stays null; profileSettled true).
    input.profileSettled = true
    m.rerender()
    said.push(m.tree())
    nextFrame()
    m.rerender()
    said.push(m.tree())
    expect(said).toEqual(['', '', '', 'Loading posts…'])
  })

  it('a logged-out visitor (no profile to wait for): announced on the next frame', () => {
    const m = mount(() => (useFeedAnnounceReady(feedLocaleSettled({ authLoading: false, user: null, profileSettled: false })) ? 'ready' : ''))
    expect(m.tree()).toBe('')
    nextFrame()
    m.rerender()
    expect(m.tree()).toBe('ready')
  })
})
