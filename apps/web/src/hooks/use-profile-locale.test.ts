// apps/web/src/hooks/use-profile-locale.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One place resolves the viewer's locale from the profile: the rule itself (resolveProfileLocale
// in lib/i18n.ts, also exported by the hook module as profileLocale), and a source guard that
// no inline copy lives anywhere else — the two moderation shells included.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: null }) }))

import { profileLocale } from './use-profile-locale'
import { resolveProfileLocale, resolveUserLocale } from '@/lib/i18n'
import { GUEST_LANGUAGE_KEY } from '@/lib/languages'
import { rememberDeviceLocale, subscribeDeviceLocale } from '@/lib/device-locale'

/** A browser whose saved guest language and whose own language are both not English. */
function browser({ stored, language }: { stored: string | null; language: string }) {
  vi.stubGlobal('localStorage', { getItem: (key: string) => (key === GUEST_LANGUAGE_KEY ? stored : null) })
  vi.stubGlobal('navigator', { language })
}

describe('profileLocale', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('the hook module and lib/i18n.ts hand out the same function', () => {
    expect(profileLocale).toBe(resolveProfileLocale)
  })

  it("is 'en' until the profile has loaded — even when the browser has another language saved and set", () => {
    // The rule: no profile yet means English, so the server render (no storage, no navigator)
    // and the first client render agree. Storage and the browser language are NOT consulted.
    browser({ stored: 'es', language: 'vi-VN' })
    expect(resolveUserLocale(null)).toBe('es') // control: the stubs are live, and this path would read them
    expect(profileLocale(null)).toBe('en')
    expect(profileLocale(undefined)).toBe('en')
  })

  it('until the profile has loaded it is the locale the page was rendered in (the cookie), never storage or the browser', () => {
    browser({ stored: 'es', language: 'vi-VN' })
    expect(profileLocale(null, 'ko')).toBe('ko')
    expect(profileLocale(undefined, 'ar')).toBe('ar')
    // Once the profile is there, the profile decides.
    expect(profileLocale({ preferred_language: 'vi' }, 'ko')).toBe('vi')
  })

  it('is the profile language when FEED supports it, whatever the browser says', () => {
    browser({ stored: 'es', language: 'vi-VN' })
    expect(profileLocale({ preferred_language: 'vi' })).toBe('vi')
    expect(profileLocale({ preferred_language: 'hmn' })).toBe('hmn')
  })

  it('with a loaded profile whose language is unsupported or missing: saved guest language, then the browser language, then English', () => {
    browser({ stored: 'es', language: 'vi-VN' })
    expect(profileLocale({ preferred_language: 'other' })).toBe('es')
    expect(profileLocale({ preferred_language: null })).toBe('es')
    expect(profileLocale({})).toBe('es')
    browser({ stored: null, language: 'vi-VN' })
    expect(profileLocale({ preferred_language: 'other' })).toBe('vi')
    browser({ stored: 'xx', language: 'de-DE' })
    expect(profileLocale({ preferred_language: 'other' })).toBe('en')
  })

  it('in Node, with no storage and no browser language, the fallback is English', () => {
    vi.stubGlobal('localStorage', undefined)
    vi.stubGlobal('navigator', undefined)
    expect(profileLocale({ preferred_language: 'other' })).toBe('en')
    expect(profileLocale(null)).toBe('en')
  })
})

describe('the rule is written once', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url))
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path)
    }
  }
  walk(SRC)

  it('only the hook reads preferred_language off the profile to pick a locale', () => {
    const inline = files
      .filter((f) => /resolveUserLocale\(\s*\(profile as/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f))
      .sort()
    expect(inline).toEqual(['lib/i18n.ts'])
    // ...and every other reader of the profile language goes through it.
    const readers = files
      .filter((f) => /\bpreferred_language\b/.test(readFileSync(f, 'utf8')) && /resolveUserLocale\(/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f))
    expect(readers).toEqual(['lib/i18n.ts'])
  })
})

describe('a device choice re-renders every reader', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('rememberDeviceLocale stores the choice, writes the cookie and notifies each subscriber once', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) })
    const jar = { cookie: '' }
    vi.stubGlobal('document', jar)
    vi.stubGlobal('location', { protocol: 'http:' })
    const calls: string[] = []
    const off = subscribeDeviceLocale(() => calls.push(store.get(GUEST_LANGUAGE_KEY) ?? ''))
    rememberDeviceLocale('vi')
    expect(calls).toEqual(['vi'])
    expect(jar.cookie).toBe('feed_locale=vi; Path=/; Max-Age=31536000; SameSite=Lax')
    // 'other' is a choice, not a locale: stored and announced, no cookie.
    jar.cookie = ''
    rememberDeviceLocale('other')
    expect(calls).toEqual(['vi', 'other'])
    expect(jar.cookie).toBe('')
    off()
    rememberDeviceLocale('es')
    expect(calls).toHaveLength(2)
  })
})

describe('portalled content keeps a truthful language', () => {
  // A source guard, on purpose: Radix portals render nothing without a DOM (renderToStaticMarkup
  // rejects createPortal, and this repo has no DOM renderer). The assistant's language and the
  // chat error banner are tested by behaviour: use-chat.locale.test.ts,
  // components/panels/chat-error-banner.lang.test.ts.
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

  it('dialog, sheet, alert-dialog and select content are English unless the caller passes its own lang', () => {
    for (const f of ['dialog', 'sheet', 'alert-dialog', 'select']) {
      const src = read(`../components/ui/${f}.tsx`)
      expect(src, f).toMatch(/lang="en"\s+dir="ltr"\s+\{\.\.\.props\}/)
    }
  })
})
