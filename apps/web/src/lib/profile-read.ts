// apps/web/src/lib/profile-read.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What a finished own-profile read (get_my_profile) does to the profile in memory, and its log
// row. The rule: a read that fails or times out for the SAME user keeps the profile already
// loaded — the member's language, name and role stay — instead of clearing it. A different user's
// profile is never kept (auth-provider drops it before the new user's read starts; sign-out
// clears it).

import { logEvent } from './logger'

export type ProfileReadOutcome = 'ok' | 'error' | 'timeout' | 'superseded'
/** Why the profile was read: the auth event, or the provider action. */
export type ProfileReadTrigger = 'INITIAL_SESSION' | 'SIGNED_IN' | 'USER_UPDATED' | 'reconcile' | 'refresh' | 'update'

/** The profile after a read for `userId` that returned `read` (null when it failed). */
export function nextProfileAfterRead<P extends object>(prev: P | null, read: P | null, userId: string): P | null {
  if (read) return read
  return prev && (prev as { id?: unknown }).id === userId ? prev : null
}

/** One auth.profile.read row per finished read. */
export function logProfileRead(
  trigger: ProfileReadTrigger,
  outcome: ProfileReadOutcome,
  profile: object | null,
  durationMs: number
): void {
  const language = profile ? (profile as { preferred_language?: unknown }).preferred_language : null
  logEvent('auth.profile.read', {
    trigger,
    outcome,
    had_language: typeof language === 'string' && language !== '',
    duration_ms: Math.round(durationMs),
  })
}
