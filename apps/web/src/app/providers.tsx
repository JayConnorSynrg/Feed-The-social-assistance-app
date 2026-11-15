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
}: {
  children: React.ReactNode
  initialUser?: InitialUser | null
  /** The feed_locale cookie's locale, read by the root layout (null without a valid cookie). */
  initialLocale?: Locale | null
}) {
  // One app-wide capture for uncaught errors + unhandled rejections -> app_logs.
  useEffect(() => installClientErrorCapture(window), [])

  return (
    <AuthProvider initialUser={initialUser}>
      <InitialLocaleContext.Provider value={initialLocale ?? 'en'}>
        <LocaleSync initialFromCookie={initialLocale !== null} />
        <VaultProvider>
          {children}
        </VaultProvider>
      </InitialLocaleContext.Provider>
    </AuthProvider>
  )
}
