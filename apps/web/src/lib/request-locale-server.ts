// apps/web/src/lib/request-locale-server.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Server only: the request's locale, read from this request's feed_locale cookie and
// Accept-Language header through the one rule in lib/request-locale.ts. The root layout
// (app/layout.tsx) and the public share pages (app/(social)/s/*) both read it here, so a page and
// the <html lang> around it always agree. Outside a request (the static Capacitor build, a unit
// test without request scope) there is no cookie or header: no locale.

import { cookies, headers } from 'next/headers'
import type { Locale } from './i18n'
import { LOCALE_COOKIE } from './locale-cookie'
import { requestLocale, type RequestLocale } from './request-locale'

const NONE: RequestLocale = { locale: null, source: null }

export async function readRequestLocale(): Promise<RequestLocale> {
  if (process.env.CAPACITOR_BUILD === 'true') return NONE
  try {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
    return requestLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerStore.get('accept-language'))
  } catch {
    return NONE
  }
}

/** The locale a server-rendered page shows: the request's, else English. */
export async function requestPageLocale(): Promise<Locale> {
  return (await readRequestLocale()).locale ?? 'en'
}
