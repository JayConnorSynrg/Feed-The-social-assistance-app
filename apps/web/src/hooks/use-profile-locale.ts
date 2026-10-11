'use client'

// apps/web/src/hooks/use-profile-locale.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The viewer's FEED locale: the signed-in profile's preferred language when supported, else
// storage -> browser -> 'en'. 'en' until the profile has loaded, so the server render and the
// first client render agree. The rule itself is resolveProfileLocale in lib/i18n.ts (exported here
// as profileLocale too); every surface reads it through this hook or that function.

import { useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { resolveProfileLocale, type Locale } from '@/lib/i18n'

export { resolveProfileLocale as profileLocale } from '@/lib/i18n'

export function useProfileLocale(): Locale {
  const { profile } = useAuth()
  return useMemo(() => resolveProfileLocale(profile), [profile])
}
