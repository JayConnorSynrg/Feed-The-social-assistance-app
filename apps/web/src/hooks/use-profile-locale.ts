'use client'

// apps/web/src/hooks/use-profile-locale.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The viewer's FEED locale: the signed-in profile's preferred language when supported, else
// storage -> browser -> 'en'. Until the profile has loaded it is the locale the server rendered the
// page in (InitialLocaleContext: the feed_locale cookie, else 'en'), so the server render and the
// first client render agree and the member's language shows from the first paint. A device choice
// (lib/device-locale.ts) re-renders every reader at once. The rule itself is resolveProfileLocale in
// lib/i18n.ts (exported here as profileLocale too); every surface reads it through this hook or
// that function.

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { resolveProfileLocale, type Locale } from '@/lib/i18n'
import { deviceLocaleServerSnapshot, deviceLocaleSnapshot, subscribeDeviceLocale } from '@/lib/device-locale'

export { resolveProfileLocale as profileLocale } from '@/lib/i18n'

/** The locale the server rendered this page in. app/providers.tsx provides it. */
export const InitialLocaleContext = createContext<Locale>('en')

/** The device choice, re-read whenever it changes (null on the server). */
export function useDeviceLocale(): string | null {
  return useSyncExternalStore(subscribeDeviceLocale, deviceLocaleSnapshot, deviceLocaleServerSnapshot)
}

export function useProfileLocale(): Locale {
  const { profile } = useAuth()
  const initial = useContext(InitialLocaleContext)
  const device = useDeviceLocale()
  // `device` is read by resolveProfileLocale through localStorage; it is a dependency so a new
  // choice recomputes the locale.
  return useMemo(() => {
    void device
    return resolveProfileLocale(profile, initial)
  }, [profile, initial, device])
}
