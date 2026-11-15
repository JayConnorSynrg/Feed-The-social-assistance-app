// apps/web/src/lib/request-locale-server.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The server reader of the request's locale: the feed_locale cookie, else Accept-Language (the rule
// in lib/request-locale.ts); outside a request — cookies() or headers() throwing — no locale and
// English pages, never an exception.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ cookie: undefined as string | undefined, header: null as string | null, throwCookies: false }))
vi.mock('next/headers', () => ({
  cookies: async () => {
    if (h.throwCookies) throw new Error('cookies was called outside a request scope')
    return { get: (name: string) => (name === 'feed_locale' && h.cookie !== undefined ? { name, value: h.cookie } : undefined) }
  },
  headers: async () => ({ get: (name: string) => (name === 'accept-language' ? h.header : null) }),
}))

import { readRequestLocale, requestPageLocale } from './request-locale-server'

beforeEach(() => {
  h.cookie = undefined
  h.header = null
  h.throwCookies = false
})

describe('readRequestLocale', () => {
  it('the cookie decides, then Accept-Language', async () => {
    h.cookie = 'ko'
    h.header = 'ar'
    expect(await readRequestLocale()).toEqual({ locale: 'ko', source: 'cookie' })
    h.cookie = undefined
    expect(await readRequestLocale()).toEqual({ locale: 'ar', source: 'header' })
  })

  it('outside a request (cookies() throws): no locale, and English pages', async () => {
    h.throwCookies = true
    h.header = 'ko'
    await expect(readRequestLocale()).resolves.toEqual({ locale: null, source: null })
    await expect(requestPageLocale()).resolves.toBe('en')
  })
})
