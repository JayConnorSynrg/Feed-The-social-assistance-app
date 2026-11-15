// apps/web/src/lib/locale-change.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One i18n.locale_changed row per change (and one per page load), with the source that caused it;
// the feed_locale cookie corrected to a loaded profile, and never to a save still in flight.

import { describe, it, expect } from 'vitest'
import { decideLocaleStep, type LocaleObservation } from './locale-change'

const obs = (o: Partial<LocaleObservation>): LocaleObservation => ({
  locale: 'en',
  device: null,
  origin: null,
  hasProfile: false,
  profileHasLocale: false,
  ...o,
})

describe('decideLocaleStep', () => {
  it('page load: one row, source cookie when the server rendered from the cookie, boot otherwise', () => {
    expect(decideLocaleStep(null, obs({ locale: 'ko' }), true, 'ko').log).toEqual({ from: 'none', to: 'ko', source: 'cookie' })
    expect(decideLocaleStep(null, obs({}), false, null).log).toEqual({ from: 'none', to: 'en', source: 'boot' })
  })

  it('no change: no row (a re-render, or the same language read again)', () => {
    const a = obs({ locale: 'ko', hasProfile: true, profileHasLocale: true, origin: 'read' })
    expect(decideLocaleStep(a, { ...a, origin: 'save' }, true, 'ko').log).toBeNull()
  })

  it('a save applying, or taking back, a language: source save', () => {
    const before = obs({ locale: 'en', hasProfile: true, profileHasLocale: true, origin: 'read' })
    const applied = obs({ locale: 'ko', hasProfile: true, profileHasLocale: true, origin: 'save' })
    expect(decideLocaleStep(before, applied, false, 'en').log).toEqual({ from: 'en', to: 'ko', source: 'save' })
    expect(decideLocaleStep(applied, { ...before, origin: 'save' }, false, 'en').log).toEqual({ from: 'ko', to: 'en', source: 'save' })
  })

  it("a guest's device choice: source save", () => {
    const before = obs({ locale: 'en', hasProfile: true, origin: 'read', device: null })
    expect(decideLocaleStep(before, { ...before, locale: 'vi', device: 'vi' }, false, 'vi').log).toEqual({ from: 'en', to: 'vi', source: 'save' })
  })

  it('a profile read: profile_read with a supported language, fallback without one', () => {
    const before = obs({ locale: 'ko' })
    expect(decideLocaleStep(before, obs({ locale: 'es', hasProfile: true, profileHasLocale: true, origin: 'read' }), true, 'ko').log?.source).toBe('profile_read')
    expect(decideLocaleStep(before, obs({ locale: 'en', hasProfile: true, profileHasLocale: false, origin: 'read' }), true, 'ko').log?.source).toBe('fallback')
  })

  it('cookie: corrected when a loaded profile disagrees; left alone before the profile and during a save', () => {
    const read = obs({ locale: 'es', hasProfile: true, profileHasLocale: true, origin: 'read' })
    expect(decideLocaleStep(null, read, true, 'ko').writeCookie).toBe(true)
    expect(decideLocaleStep(null, read, true, 'es').writeCookie).toBe(false)
    expect(decideLocaleStep(null, obs({ locale: 'ko' }), true, 'ko').writeCookie).toBe(false)
    expect(decideLocaleStep(null, obs({ locale: 'en' }), false, null).writeCookie).toBe(false)
    expect(decideLocaleStep(read, { ...read, locale: 'ko', origin: 'save' }, true, 'es').writeCookie).toBe(false)
  })
})
