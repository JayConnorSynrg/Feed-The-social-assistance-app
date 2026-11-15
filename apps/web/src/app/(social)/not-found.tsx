// apps/web/src/app/(social)/not-found.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What a share page shows when its id is missing, hidden or not public (notFound() in /s/*): a
// heading, a line and a link home, in the visitor's language (the root layout's rule,
// lib/request-locale-server.ts) with lang/dir on its root — the root layout wraps every page in
// lang="en". The 404 status and the "… Not Found - FEED" titles are the pages' own, unchanged.

import Link from 'next/link'
import { dir, t } from '@/lib/i18n'
import { shareT } from '@/lib/i18n-share'
import { requestPageLocale } from '@/lib/request-locale-server'

export default async function SocialNotFound() {
  const locale = await requestPageLocale()
  return (
    <div lang={locale} dir={dir(locale)} className="space-y-4 py-12 text-center">
      <h1 className="text-2xl font-bold text-stone-800">{shareT(locale, 'notFoundTitle')}</h1>
      <p className="text-stone-700">{shareT(locale, 'notFoundBody')}</p>
      <Link
        href="/"
        className="inline-flex min-h-6 items-center justify-center rounded-lg bg-lime-700 px-8 py-3 text-white font-semibold hover:bg-lime-800 transition-colors"
      >
        {t(locale, 'goHome')}
      </Link>
    </div>
  )
}
