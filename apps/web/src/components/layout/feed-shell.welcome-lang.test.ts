// apps/web/src/components/layout/feed-shell.welcome-lang.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Every piece of text is marked with the language it is written in (WCAG 3.1.2). The WelcomeCard sits in
// #app-content lang="en": its heading and tagline are English, its date is in the member's locale, so the
// date carries its own lang and dir.

import { describe, it, expect, vi } from 'vitest'

const h = vi.hoisted(() => ({ locale: 'ar' }))
vi.mock('@/hooks/use-profile-locale', () => ({ useProfileLocale: () => h.locale }))

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { WelcomeCard } from './feed-shell'
import { formatDate } from '@/lib/i18n-intl'
import type { Locale } from '@/lib/i18n'

const render = (locale: Locale) => {
  h.locale = locale
  return renderToStaticMarkup(createElement(WelcomeCard, { userName: 'Sam', userRole: 'recipient' }))
}
const today = (locale: Locale) => formatDate(new Date().toISOString(), locale, Intl.DateTimeFormat().resolvedOptions().timeZone)

describe('WelcomeCard language marks', () => {
  it('ar: the date is marked Arabic and right-to-left, and is the Arabic date', () => {
    const out = render('ar')
    expect(out).toContain(`<span lang="ar" dir="rtl">${today('ar')}</span>`)
  })

  it('the English words carry no other-language mark (they inherit #app-content lang="en")', () => {
    const out = render('ar')
    expect(out.match(/lang="/g)).toHaveLength(1)
    expect(out).toContain('Welcome back, Sam!')
  })

  it('en: the date is marked English, left-to-right', () => {
    expect(render('en')).toContain(`<span lang="en" dir="ltr">${today('en')}</span>`)
  })
})
