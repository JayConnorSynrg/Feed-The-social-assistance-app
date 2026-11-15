// apps/web/src/components/settings/language-section.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The reported bug, as a test: a member saves 한국어, the Language section is rendered again (as
// when they leave it and come back), and it shows Korean — the picker, the section's own words,
// its lang — and the locale every surface reads is Korean, with no profile re-read.
// The account save runs through the provider's real IO (accountLanguageIo) against a fake
// Supabase client; the in-memory profile is a plain holder standing in for AuthProvider state.
// No DOM renderer in this repo: the section is rendered with renderToStaticMarkup.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => auth.value }))
vi.mock('@/lib/logger', async () => {
  const core = await import('@/lib/with-metric-core.mjs')
  return {
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    logEvent: vi.fn(),
    withMetric: (op: string, attrs: Record<string, string | number | boolean | null>, fn: () => Promise<unknown>) =>
      core.runWithMetric({ emit: () => {}, sink: () => {} }, op, attrs, fn, 'req'),
  }
})

import { LanguageSection, SaveStatusLines } from './language-section'
import { accountLanguageIo } from '@/providers/auth-provider'
import { saveAccountLanguage } from '@/lib/language-save'
import { resolveProfileLocale } from '@/lib/i18n'
import type { Profile } from '@feed/database'
import type { ProfileOrigin } from '@/lib/locale-change'

/** A fake Supabase client: records the profile write and counts get_my_profile calls. */
function fakeClient(answer: { data: unknown[] | null; error: { message: string; code?: string } | null }) {
  const calls = { updates: [] as unknown[], eq: [] as unknown[], select: [] as string[], rpc: 0 }
  const client = {
    from: (table: string) => {
      expect(table).toBe('profiles')
      return {
        update: (values: unknown) => {
          calls.updates.push(values)
          return {
            eq: (col: string, val: string) => {
              calls.eq.push([col, val])
              return {
                select: (cols: string) => {
                  calls.select.push(cols)
                  return { abortSignal: async () => answer }
                },
              }
            },
          }
        },
      }
    },
    rpc: () => {
      calls.rpc += 1
      return { abortSignal: async () => ({ data: null, error: null }) }
    },
  }
  return { client: client as unknown as Parameters<typeof accountLanguageIo>[0], calls }
}

/** AuthProvider's state for one member, and its saveLanguage wired as the provider wires it. */
function member(answer: Parameters<typeof fakeClient>[0]) {
  const { client, calls } = fakeClient(answer)
  const holder = { profile: { id: 'u1', full_name: 'Min', preferred_language: 'en' } as unknown as Profile | null, origin: null as ProfileOrigin }
  const setProfile = (next: Profile | null | ((p: Profile | null) => Profile | null)) => {
    holder.profile = typeof next === 'function' ? next(holder.profile) : next
  }
  const setOrigin = (next: ProfileOrigin | ((p: ProfileOrigin) => ProfileOrigin)) => {
    holder.origin = typeof next === 'function' ? next(holder.origin) : next
  }
  const sync = () => {
    auth.value = {
      user: { id: 'u1' },
      isAnonymous: false,
      profile: holder.profile,
      saveLanguage: (code: string) =>
        saveAccountLanguage(
          accountLanguageIo(client, 'u1', setProfile, setOrigin),
          (holder.profile as { preferred_language?: string | null } | null)?.preferred_language ?? null,
          code
        ),
    }
  }
  sync()
  return { holder, calls, sync }
}

const render = () => renderToStaticMarkup(createElement(LanguageSection))

describe('Settings › Language', () => {
  let cookieJar: { cookie: string }
  beforeEach(() => {
    cookieJar = { cookie: '' }
    vi.stubGlobal('document', cookieJar)
    vi.stubGlobal('location', { protocol: 'https:' })
    vi.stubGlobal('localStorage', { getItem: () => null })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('save 한국어, render the section again: the picker and the section are Korean, with no profile re-read', async () => {
    const m = member({ data: [{ id: 'u1' }], error: null })
    const before = render()
    expect(before).toContain('<option value="en" selected="">')
    expect(before).toMatch(/<section lang="en" dir="ltr"/)

    expect(await (auth.value.saveLanguage as (c: string) => Promise<string>)('ko')).toBe('ok')
    m.sync() // the provider re-renders its consumers with its state

    const after = render()
    expect(after).toContain('<option value="ko" selected="">')
    expect(after).toMatch(/<section lang="ko" dir="ltr"/)
    expect(after).toContain('선호 언어')
    expect(after).toContain('현재: <span lang="ko" dir="ltr">한국어</span>')
    // The locale every surface reads, from the same in-memory profile.
    expect(resolveProfileLocale(m.holder.profile)).toBe('ko')
    expect(m.holder.origin).toBe('save')
    // One write on the member's own row, returning the row; no get_my_profile call.
    expect(m.calls.updates).toEqual([{ preferred_language: 'ko' }])
    expect(m.calls.eq).toEqual([['id', 'u1']])
    expect(m.calls.select).toEqual(['id'])
    expect(m.calls.rpc).toBe(0)
    // The next page load renders Korean from the first paint.
    expect(cookieJar.cookie).toBe('feed_locale=ko; Path=/; Max-Age=31536000; SameSite=Lax; Secure')
  })

  it('a save that updates no row: English stays, the cookie is untouched, and the failure is said in English', async () => {
    const m = member({ data: [], error: null })
    expect(await (auth.value.saveLanguage as (c: string) => Promise<string>)('ko')).toBe('no_row')
    m.sync()
    expect(render()).toContain('<option value="en" selected="">')
    expect(resolveProfileLocale(m.holder.profile)).toBe('en')
    expect(cookieJar.cookie).toBe('')
    const failure = renderToStaticMarkup(createElement(SaveStatusLines, { locale: 'en', saving: false, status: 'failed' }))
    expect(failure).toContain('role="alert"')
    expect(failure).toContain('Your language could not be saved. FEED is still in <span lang="en" dir="ltr">English</span>. Please try again.')
    expect(failure).not.toContain('Language saved')
  })

  it('a save the server refuses: the same — the old language, and a failure message', async () => {
    const m = member({ data: null, error: { code: '42501', message: 'permission denied' } })
    expect(await (auth.value.saveLanguage as (c: string) => Promise<string>)('ar')).toBe('error')
    m.sync()
    expect(resolveProfileLocale(m.holder.profile)).toBe('en')
  })

  it('success is said in the new language', () => {
    expect(renderToStaticMarkup(createElement(SaveStatusLines, { locale: 'ko', saving: false, status: 'saved' }))).toContain('언어가 저장되었습니다')
    expect(renderToStaticMarkup(createElement(SaveStatusLines, { locale: 'ko', saving: true, status: null }))).toContain('저장 중…')
  })

  it('Arabic: the section reads right to left; the select is named by the heading it shows', () => {
    member({ data: [], error: null })
    auth.value = { ...auth.value, profile: { id: 'u1', preferred_language: 'ar' } }
    const html = render()
    expect(html).toMatch(/<section lang="ar" dir="rtl" aria-labelledby="([^"]+)"/)
    const id = html.match(/<h3 id="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`aria-labelledby="${id}"`)
    expect(html).toContain('اللغة المفضلة')
  })

  it("a guest: the device's language, and the device-only note in it", () => {
    vi.stubGlobal('localStorage', { getItem: (k: string) => (k === 'feed_preferred_language' ? 'vi' : null) })
    auth.value = { user: { id: 'g1' }, isAnonymous: true, profile: { id: 'g1', preferred_language: null }, saveLanguage: vi.fn() }
    const html = render()
    expect(html).toMatch(/<section lang="vi"/)
    expect(html).toContain('<option value="vi" selected="">')
    expect(html).toContain('Chỉ lưu trên thiết bị này.')
  })
})
