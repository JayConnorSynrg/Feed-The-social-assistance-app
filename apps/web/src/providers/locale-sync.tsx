'use client'

// apps/web/src/providers/locale-sync.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Keeps the document in step with the viewer's locale (useProfileLocale): <html lang dir>, the
// feed_locale cookie when a loaded profile disagrees with it, and one i18n.locale_changed row per
// change (lib/locale-change.ts decides which). Renders nothing.

import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useDeviceLocale, useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, isLocale } from '@/lib/i18n'
import { readLocaleCookie, writeLocaleCookie } from '@/lib/locale-cookie'
import { decideLocaleStep, type LocaleObservation } from '@/lib/locale-change'
import { logEvent } from '@/lib/logger'

export function LocaleSync({ initialFromCookie }: { initialFromCookie: boolean }) {
  const locale = useProfileLocale()
  const device = useDeviceLocale()
  const { profile, profileOrigin } = useAuth()
  const before = useRef<LocaleObservation | null>(null)

  const hasProfile = profile !== null
  const profileHasLocale = isLocale((profile as { preferred_language?: unknown } | null)?.preferred_language)

  useEffect(() => {
    const now: LocaleObservation = { locale, device, origin: profileOrigin, hasProfile, profileHasLocale }
    const step = decideLocaleStep(before.current, now, initialFromCookie, readLocaleCookie())
    before.current = now
    if (step.log) logEvent('i18n.locale_changed', step.log)
    if (step.writeCookie) writeLocaleCookie(locale)
    const root = document.documentElement
    if (root.lang !== locale) root.lang = locale
    if (root.dir !== dir(locale)) root.dir = dir(locale)
  }, [locale, device, profileOrigin, hasProfile, profileHasLocale, initialFromCookie])

  return null
}
