// apps/web/src/app/(admin)/moderation/admin-focus-gate-status.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// When a followed "Edit in admin" link opened nothing (the shell gate wrote forbidden / invalid), the
// admin sees — and hears — why: one role="status" region, present (empty) before, filled with a
// plain line in the viewer's language. Copy parity across the 14 locales.

import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AdminFocusGateStatus, adminFocusGateText } from './admin-focus-gate-status'
import { adminFocusMessages, adminFocusT } from '@/lib/i18n-admin-focus'
import { messages, type Locale } from '@/lib/i18n'

const LOCALES = Object.keys(messages) as Locale[]
const region = (html: string) => html.match(/^<p role="status" lang="[^"]*" dir="[^"]*" data-testid="admin-focus-gate-status" class="([^"]*)">([^<]*)<\/p>$/)

describe('AdminFocusGateStatus', () => {
  it('no row: the region is rendered, empty and visually hidden (so a later line is announced)', () => {
    const m = region(renderToStaticMarkup(h(AdminFocusGateStatus, { row: null, locale: 'en' })))
    expect(m?.[1]).toBe('sr-only')
    expect(m?.[2]).toBe('')
  })

  it('forbidden / invalid: a visible plain line; found-type rows show nothing', () => {
    const forbidden = region(renderToStaticMarkup(h(AdminFocusGateStatus, { row: { kind: 'post', outcome: 'forbidden', tab: 'moderation' }, locale: 'en' })))
    expect(forbidden?.[1]).not.toContain('sr-only')
    expect(forbidden?.[2]).toBe("This admin link opens a screen your role doesn&#x27;t include, so nothing was opened.")
    expect(adminFocusGateText({ kind: 'unknown', outcome: 'invalid', tab: 'unknown' }, 'en')).toBe('This admin link is incomplete or broken, so nothing was opened.')
    expect(adminFocusGateText({ kind: 'event', outcome: 'invalid', tab: 'events' }, 'es')).toBe(adminFocusMessages.es.invalid)
    expect(adminFocusGateText({ kind: 'post', outcome: 'found', tab: 'moderation' }, 'en')).toBeNull()
  })
})

describe('the line carries its own language and direction (the admin shell has no lang wrapper)', () => {
  it.each([
    ['en', 'ltr'],
    ['es', 'ltr'],
    ['ar', 'rtl'],
    ['hmn', 'ltr'],
  ] as const)('%s → lang="%s" dir="%s"', (locale, direction) => {
    const html = renderToStaticMarkup(h(AdminFocusGateStatus, { row: { kind: 'post', outcome: 'forbidden', tab: 'moderation' }, locale }))
    expect(html).toMatch(new RegExp(`^<p role="status" lang="${locale}" dir="${direction}"`))
    expect(html).toContain(adminFocusMessages[locale].forbidden.replace(/'/g, '&#x27;'))
  })
})

describe('adminFocusMessages', () => {
  it('covers exactly the 14 locales with the same keys, none empty, translated', () => {
    expect(Object.keys(adminFocusMessages).sort()).toEqual([...LOCALES].sort())
    expect(LOCALES).toHaveLength(14)
    for (const locale of LOCALES) {
      expect(Object.keys(adminFocusMessages[locale]), locale).toEqual(['forbidden', 'invalid'])
      for (const key of ['forbidden', 'invalid'] as const) {
        expect(adminFocusT(locale, key).trim(), locale).not.toBe('')
        if (locale !== 'en') expect(adminFocusT(locale, key), `${locale}.${key}`).not.toBe(adminFocusMessages.en[key])
      }
    }
  })
})
