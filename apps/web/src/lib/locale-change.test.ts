// apps/web/src/lib/locale-change.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One i18n.locale_changed row per change (and one per page load), with the source that caused it;
// the feed_locale cookie corrected to a loaded profile, and never to a save still in flight.
// First the decision (decideLocaleStep), then LocaleSync itself (providers/locale-sync.tsx), mounted
// with the mini hook runtime and driven through a page's life: load, profile read, a save in flight,
// re-renders with nothing new.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
const auth = vi.hoisted(() => ({ value: { profile: null as unknown, profileOrigin: null as string | null } }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => auth.value }))
const logged = vi.hoisted(() => [] as Array<[string, unknown]>)
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: unknown) => logged.push([name, attrs]),
}))

import { mount } from '@/test/mini-react'
import { LocaleSync } from '@/providers/locale-sync'
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


/** A browser document whose cookie writes are counted. */
function browser(cookie = '') {
  const doc = {
    jar: cookie,
    writes: [] as string[],
    documentElement: { lang: 'en', dir: 'ltr' },
    get cookie() {
      return this.jar
    },
    set cookie(v: string) {
      this.writes.push(v)
      this.jar = v.split(';')[0]
    },
  }
  vi.stubGlobal('document', doc)
  vi.stubGlobal('location', { protocol: 'https:' })
  vi.stubGlobal('localStorage', { getItem: () => null })
  return doc
}

const changes = () => logged.filter(([n]) => n === 'i18n.locale_changed').map(([, a]) => a)

beforeEach(() => {
  logged.length = 0
  auth.value = { profile: null, profileOrigin: null }
})
afterEach(() => vi.unstubAllGlobals())

describe('LocaleSync', () => {
  it('load → profile read → save in flight → saved: one row per change, no cookie write mid-save', () => {
    const doc = browser()
    const m = mount(() => LocaleSync({ initialFromCookie: false }))
    expect(changes()).toEqual([{ from: 'none', to: 'en', source: 'boot' }])
    expect(doc.writes).toEqual([])

    // The profile loads in English: no change to log; the cookie is set to the account's language.
    auth.value = { profile: { id: 'u1', preferred_language: 'en' }, profileOrigin: 'read' }
    m.rerender()
    expect(changes()).toHaveLength(1)
    expect(doc.writes).toEqual(['feed_locale=en; Path=/; Max-Age=31536000; SameSite=Lax; Secure'])

    // A save applies 한국어 and is still in flight: one row, no cookie write, <html> follows.
    auth.value = { profile: { id: 'u1', preferred_language: 'ko' }, profileOrigin: 'save' }
    m.rerender()
    m.rerender()
    expect(changes()).toEqual([
      { from: 'none', to: 'en', source: 'boot' },
      { from: 'en', to: 'ko', source: 'save' },
    ])
    expect(doc.writes).toHaveLength(1)
    expect(doc.documentElement).toEqual({ lang: 'ko', dir: 'ltr' })

    // Re-renders with nothing new write nothing.
    m.rerender()
    expect(changes()).toHaveLength(2)
    expect(doc.writes).toHaveLength(1)
  })

  it('page loaded from the cookie, profile says otherwise: the cookie is corrected and the change logged once', () => {
    const doc = browser('feed_locale=ko')
    const m = mount(() => LocaleSync({ initialFromCookie: true }))
    // No provider in this test: the pre-profile locale is the context default, English.
    expect(changes()).toEqual([{ from: 'none', to: 'en', source: 'cookie' }])
    auth.value = { profile: { id: 'u1', preferred_language: 'ar' }, profileOrigin: 'read' }
    m.rerender()
    m.rerender()
    expect(changes()).toEqual([
      { from: 'none', to: 'en', source: 'cookie' },
      { from: 'en', to: 'ar', source: 'profile_read' },
    ])
    expect(doc.writes).toEqual(['feed_locale=ar; Path=/; Max-Age=31536000; SameSite=Lax; Secure'])
    expect(doc.documentElement).toEqual({ lang: 'ar', dir: 'rtl' })
  })
})
