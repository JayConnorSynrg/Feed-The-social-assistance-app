'use client'

import { useEffect } from 'react'
import { AuthProvider, type InitialUser } from '@/providers/auth-provider'
import { VaultProvider } from '@/contexts/vault-context'
import { installClientErrorCapture } from '@/lib/client-error-capture'
import { InitialLocaleContext } from '@/hooks/use-profile-locale'
import { LocaleSync } from '@/providers/locale-sync'
import type { Locale } from '@/lib/i18n'

export function Providers({
  children,
  initialUser = null,
  initialLocale = null,
  initialFromCookie = initialLocale !== null,
}: {
  children: React.ReactNode
  initialUser?: InitialUser | null
  /** The request's locale, read by the root layout (lib/request-locale.ts: the feed_locale cookie,
   *  else Accept-Language; null when neither names a FEED locale). */
  initialLocale?: Locale | null
  /** The cookie decided initialLocale (false when Accept-Language did). */
  initialFromCookie?: boolean
}) {
  // One app-wide capture for uncaught errors + unhandled rejections -> app_logs.
  useEffect(() => installClientErrorCapture(window), [])

  return (
    <AuthProvider initialUser={initialUser}>
      <InitialLocaleContext.Provider value={initialLocale ?? 'en'}>
        <LocaleSync initialFromCookie={initialFromCookie} />
        <VaultProvider>
          {children}
        </VaultProvider>
      </InitialLocaleContext.Provider>
    </AuthProvider>
  )
}
