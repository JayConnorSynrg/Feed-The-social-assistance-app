'use client'

// apps/web/src/hooks/use-profile-locale.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The viewer's FEED locale, resolved in one place: the signed-in profile's preferred language when
// supported, else storage -> browser -> 'en' (resolveUserLocale). 'en' until the profile has
// loaded, so the server render and the first client render agree.

import { useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { resolveUserLocale, type Locale } from '@/lib/i18n'

/** The rule itself, for a caller that already holds the profile: 'en' while there is none. */
export function profileLocale(profile: object | null | undefined): Locale {
  return profile ? resolveUserLocale((profile as { preferred_language?: string | null }).preferred_language ?? null) : 'en'
}

export function useProfileLocale(): Locale {
  const { profile } = useAuth()
  return useMemo(() => profileLocale(profile), [profile])
}
