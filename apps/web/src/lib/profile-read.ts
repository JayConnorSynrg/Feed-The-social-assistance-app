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
export type ProfileReadTrigger = 'INITIAL_SESSION' | 'SIGNED_IN' | 'USER_UPDATED' | 'reconcile' | 'refresh' | 'update' | 'language_save'

/** A language save in flight: whose, and the language on screen while it runs. */
export interface PendingLanguage {
  userId: string
  code: string | null
}

/** The profile after a read for `userId` that returned `read` (null when it failed). */
export function nextProfileAfterRead<P extends object>(prev: P | null, read: P | null, userId: string): P | null {
  if (read) return read
  return prev && (prev as { id?: unknown }).id === userId ? prev : null
}

/**
 * A read that lands while a language save is in flight for the same user carries the language on
 * screen, not the one the database held when the read ran: the screen does not flip back mid-save.
 */
export function withPendingLanguage<P extends object>(profile: P | null, pending: PendingLanguage | null): P | null {
  if (!profile || !pending || (profile as { id?: unknown }).id !== pending.userId) return profile
  return { ...profile, preferred_language: pending.code }
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
