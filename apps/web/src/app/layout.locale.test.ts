// apps/web/src/app/layout.locale.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The root layout renders the document in the language of the feed_locale cookie: <html lang dir>,
// and the initial locale handed to the client (so translated surfaces render in it before the
// profile arrives). The app's own content stays marked English until each surface's root says
// otherwise. Without a cookie, the browser's Accept-Language decides (lib/request-locale.ts); the
// cookie always wins over it. Called as the server calls it, with the request cookie, headers and Supabase mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isValidElement, type ReactElement } from 'react'

const req = vi.hoisted(() => ({ cookie: undefined as string | undefined, acceptLanguage: null as string | null }))
vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'feed_locale' && req.cookie !== undefined ? { name, value: req.cookie } : undefined) }),
  headers: async () => ({ get: (name: string) => (name === 'accept-language' ? req.acceptLanguage : null) }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: null } }) } }) }))
vi.mock('./providers', () => ({ Providers: (p: { children: unknown }) => p.children }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import RootLayout from './layout'
import { Providers } from './providers'

type El = ReactElement<Record<string, unknown>>
const children = (el: El): El[] => {
  const c = el.props.children
  return (Array.isArray(c) ? c : [c]).filter(isValidElement) as El[]
}
async function render(cookie: string | undefined) {
  req.cookie = cookie
  const html = (await RootLayout({ children: 'page' })) as El
  const body = children(html)[0]
  const providers = children(body).find((e) => e.type === Providers)!
  const appContent = children(providers)[0]
  return { html: html.props, providers: providers.props, appContent: appContent.props }
}

describe('<html> from the feed_locale cookie', () => {
  beforeEach(() => {
    req.cookie = undefined
    req.acceptLanguage = null
  })

  it.each([
    ['ko', 'ko', 'ltr', 'ko'],
    ['ar', 'ar', 'rtl', 'ar'],
    ['xx', 'en', 'ltr', null],
    ['other', 'en', 'ltr', null],
    [undefined, 'en', 'ltr', null],
  ])('cookie %s: <html lang="%s" dir="%s">, initial locale %s', async (cookie, lang, dir, initial) => {
    const r = await render(cookie)
    expect(r.html).toMatchObject({ lang, dir })
    expect(r.providers.initialLocale).toBe(initial)
    expect(r.appContent).toMatchObject({ id: 'app-content', lang: 'en', dir: 'ltr' })
  })
})

describe('<html> from Accept-Language when there is no cookie', () => {
  beforeEach(() => {
    req.cookie = undefined
    req.acceptLanguage = null
  })

  it('the cookie beats the header', async () => {
    req.acceptLanguage = 'ko-KR,ko;q=0.9'
    const r = await render('es')
    expect(r.html).toMatchObject({ lang: 'es', dir: 'ltr' })
    expect(r.providers).toMatchObject({ initialLocale: 'es', initialFromCookie: true })
  })

  it('the header beats the English default, and is not reported as a cookie', async () => {
    req.acceptLanguage = 'ar-EG,ar;q=0.9,en;q=0.5'
    const r = await render(undefined)
    expect(r.html).toMatchObject({ lang: 'ar', dir: 'rtl' })
    expect(r.providers).toMatchObject({ initialLocale: 'ar', initialFromCookie: false })
    expect(r.appContent).toMatchObject({ id: 'app-content', lang: 'en', dir: 'ltr' })
  })

  it.each(['de-DE,de;q=0.9', ';;;,,=q', '*'])('an unsupported or malformed header %j falls back to English', async (header) => {
    req.acceptLanguage = header
    const r = await render(undefined)
    expect(r.html).toMatchObject({ lang: 'en', dir: 'ltr' })
    expect(r.providers.initialLocale).toBe(null)
  })
})
