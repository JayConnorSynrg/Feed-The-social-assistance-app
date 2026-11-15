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

// The mini hook runtime drives LanguageSection itself (its state and the select's onChange);
// outside mount() hooks fall through to React, so renderToStaticMarkup still renders.
vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

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
import { mount, findAll } from '@/test/mini-react'

type Mounted = { tree: () => unknown; rerender: () => unknown }
const el = (m: Mounted, pred: (e: { type: unknown; props: Record<string, unknown> }) => boolean) => findAll(m.tree(), pred)[0]
const select = (m: Mounted) => el(m, (e) => e.type === 'select')
const saveButton = (m: Mounted) => el(m, (e) => e.props['data-testid'] === 'settings-language-save')
const pick = (m: Mounted, code: string) => {
  ;(select(m).props.onChange as (e: { target: { value: string } }) => void)({ target: { value: code } })
  m.rerender()
}
const submit = (m: Mounted) => {
  const form = el(m, (e) => e.type === 'form')
  ;(form.props.onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault: () => {} })
}
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
  return { client: client as unknown as Parameters<typeof accountLanguageIo>[0]['supabase'], calls }
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
          accountLanguageIo({
            supabase: client,
            userId: 'u1',
            setProfile,
            setProfileOrigin: setOrigin,
            ensureProfile: async () => (holder.profile as { preferred_language?: string | null } | null)?.preferred_language ?? null,
            isCurrentUser: () => true,
            pending: { current: null },
          }),
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
    expect(before).toMatch(/<option value="en"[^>]*selected=""/)
    expect(before).toMatch(/<section lang="en" dir="ltr"/)

    expect(await (auth.value.saveLanguage as (c: string) => Promise<string>)('ko')).toBe('ok')
    m.sync() // the provider re-renders its consumers with its state

    const after = render()
    expect(after).toMatch(/<option value="ko"[^>]*selected=""/)
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
    expect(render()).toMatch(/<option value="en"[^>]*selected=""/)
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
    expect(html).toMatch(/<option value="vi"[^>]*selected=""/)
    expect(html).toContain('Chỉ lưu trên thiết bị này.')
  })
})

describe('what the member sees after a choice (the save outcome, mapped to the message)', () => {
  beforeEach(() => vi.stubGlobal('localStorage', { getItem: () => null }))
  afterEach(() => vi.unstubAllGlobals())

  /** Mount the section, pick 한국어, Save, and return the message lines as rendered. */
  async function choose(outcome: string, profileAfter: Record<string, unknown>) {
    const saveLanguage = vi.fn(async () => {
      // The provider has applied (ok) or taken back (failure) the language by the time it answers.
      auth.value = { ...auth.value, profile: profileAfter }
      return outcome
    })
    auth.value = { user: { id: 'u1' }, isAnonymous: false, profile: { id: 'u1', preferred_language: 'en' }, saveLanguage }
    const m = mount(() => LanguageSection())
    const select = findAll(m.tree(), (el) => el.type === 'select')[0]
    ;(select.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'ko' } })
    m.rerender()
    submit(m)
    await m.flush()
    m.rerender()
    expect(saveLanguage).toHaveBeenCalledWith('ko')
    const lines = findAll(m.tree(), (el) => el.type === SaveStatusLines)[0].props as Parameters<typeof SaveStatusLines>[0]
    return { lines, html: renderToStaticMarkup(createElement(SaveStatusLines, lines)) }
  }

  it.each(['no_row', 'aborted', 'error', 'no_profile'])('%s: the failure line in the language still in effect, never "Language saved"', async (outcome) => {
    const { lines, html } = await choose(outcome, { id: 'u1', preferred_language: 'en' })
    expect(lines.status).toBe('failed')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Your language could not be saved. FEED is still in <span lang="en" dir="ltr">English</span>.')
    expect(html).not.toContain('Language saved')
  })

  it('ok: "Language saved", in the new language, and no failure line', async () => {
    const { lines, html } = await choose('ok', { id: 'u1', preferred_language: 'ko' })
    expect(lines).toMatchObject({ status: 'saved', locale: 'ko', saving: false })
    expect(html).toContain('언어가 저장되었습니다')
    // The alert region stays in the tree, empty.
    expect(html).toMatch(/<p role="alert"[^>]*><\/p>/)
  })
})

describe('choosing is not saving (keyboard browsing, focus, a save in flight)', () => {
  beforeEach(() => vi.stubGlobal('localStorage', { getItem: () => null }))
  afterEach(() => vi.unstubAllGlobals())

  function setup(saveLanguage = vi.fn(async () => 'ok')) {
    auth.value = { user: { id: 'u1' }, isAnonymous: false, profile: { id: 'u1', preferred_language: 'en' }, saveLanguage }
    return { m: mount(() => LanguageSection()), saveLanguage }
  }

  it('arrowing through the list (one change per language passed) saves nothing; Save commits only the last', async () => {
    const { m, saveLanguage } = setup()
    for (const code of ['es', 'ht', 'vi', 'ar', 'zh', 'ko']) pick(m, code)
    await m.flush()
    expect(saveLanguage).not.toHaveBeenCalled()
    expect(select(m).props.value).toBe('ko')
    expect(saveButton(m).props['aria-disabled']).toBe(false)
    submit(m)
    await m.flush()
    expect(saveLanguage.mock.calls).toEqual([['ko']])
  })

  it('Save with nothing new is aria-disabled, stays focusable, and does nothing', async () => {
    const { m, saveLanguage } = setup()
    const button = saveButton(m)
    expect(button.props['aria-disabled']).toBe(true)
    expect(button.props.disabled).toBeUndefined()
    submit(m)
    pick(m, 'es')
    pick(m, 'en') // back to the language in effect
    expect(saveButton(m).props['aria-disabled']).toBe(true)
    submit(m)
    await m.flush()
    expect(saveLanguage).not.toHaveBeenCalled()
  })

  it('while a save runs: the list keeps focus (never disabled), Save is aria-disabled, a second submit is ignored', async () => {
    let answer: (o: string) => void = () => {}
    const { m, saveLanguage } = setup(vi.fn(() => new Promise<string>((r) => (answer = r))))
    pick(m, 'ko')
    submit(m)
    m.rerender()
    expect(select(m).props.disabled).toBeUndefined()
    expect(saveButton(m).props['aria-disabled']).toBe(true)
    submit(m)
    expect(saveLanguage).toHaveBeenCalledTimes(1)
    answer('ok')
    await m.flush()
  })

  it('both live regions are in the tree before anything happens', () => {
    const { m } = setup()
    const lines = el(m, (e) => e.type === SaveStatusLines)
    const html = renderToStaticMarkup(createElement(SaveStatusLines, lines.props as Parameters<typeof SaveStatusLines>[0]))
    expect(html).toMatch(/<p role="status"[^>]*><\/p>/)
    expect(html).toMatch(/<p role="alert"[^>]*><\/p>/)
    expect(html).not.toMatch(/hidden/)
  })
})

describe('the list of languages', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('each option is one language: its own name, marked with its own lang; "other" in the viewer\'s language', () => {
    vi.stubGlobal('localStorage', { getItem: () => null })
    auth.value = { user: { id: 'u1' }, isAnonymous: false, profile: { id: 'u1', preferred_language: 'ko' }, saveLanguage: vi.fn() }
    const html = render()
    expect(html).toContain('<option value="ko" lang="ko" dir="ltr" selected="">한국어</option>')
    expect(html).toContain('<option value="ar" lang="ar" dir="rtl">العربية</option>')
    expect(html).toContain('<option value="en" lang="en" dir="ltr">English</option>')
    expect(html).toContain('<option value="other" lang="ko" dir="ltr">기타 언어</option>')
    expect(html).not.toMatch(/<option[^>]*>[^<]*—/)
  })

  it('readable: "Currently" at stone-600, the list with a 3:1 border and a chevron', () => {
    vi.stubGlobal('localStorage', { getItem: () => null })
    auth.value = { user: { id: 'u1' }, isAnonymous: false, profile: { id: 'u1', preferred_language: 'en' }, saveLanguage: vi.fn() }
    const html = render()
    expect(html).toMatch(/<p class="[^"]*text-stone-600[^"]*">Currently: /)
    expect(html).toMatch(/<select[^>]*class="[^"]*border-stone-500/)
    const chevron = html.match(/<svg[^>]*lucide-chevron-down[^>]*>/)?.[0] ?? ''
    expect(chevron).toContain('aria-hidden="true"')
  })
})
