'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import type { Profile, Database } from '@feed/database'
import { logger } from '@/lib/logger'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'
import { isLocale } from '@/lib/i18n'
import { writeLocaleCookie } from '@/lib/locale-cookie'
import { saveAccountLanguage, type AccountLanguageSaveIo, type LanguageSaveOutcome } from '@/lib/language-save'
import {
  logProfileRead,
  nextProfileAfterRead,
  withPendingLanguage,
  type PendingLanguage,
  type ProfileReadOutcome,
  type ProfileReadTrigger,
} from '@/lib/profile-read'
import type { ProfileOrigin } from '@/lib/locale-change'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: AuthError | null
  isAuthenticated: boolean
  /** True when the active session is an anonymous (guest) session created via signInAnonymously(). */
  isAnonymous: boolean
  /** True once the background profile read for the CURRENT user has finished — loaded, failed or
   *  timed out (profile may still be null). False while it runs, before any user, and again
   *  whenever the user changes, until that user's read finishes. */
  profileSettled: boolean
  /** What last set `profile`: a read, a language save (or its revert), or a clear. */
  profileOrigin: ProfileOrigin
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  updateProfile: (updates: ProfileUpdate) => Promise<void>
  /** Saves the account language: applied at once, taken back on failure (lib/language-save.ts). */
  saveLanguage: (code: string) => Promise<LanguageSaveOutcome>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Module-level singleton - avoids re-creating on every render
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

/**
 * Server-trusted identity resolved from the JWT-verified request cookie in
 * layout.tsx (supabase.auth.getClaims()). It seeds the client so a
 * server-authenticated user renders authenticated immediately, and it is the
 * identity the browser client reconciles against on mount.
 */
export interface InitialUser {
  id: string
  email: string | null
  is_anonymous: boolean
}

interface AuthProviderProps {
  children: ReactNode
  initialUser?: InitialUser | null
}

/** True when a Supabase User carries the anonymous (guest) flag. */
function isAnonymousUser(u: User | null): boolean {
  return (u as unknown as { is_anonymous?: boolean } | null)?.is_anonymous ?? false
}

// ─── coord helper ───────────────────────────────────────────────────────────
// latitude/longitude are REVOKED from direct column SELECT (coord-read lockdown,
// migration 20260606130000). We fetch them via the SECDEF accessor get_my_coordinates()
// which enforces own-row access only (WHERE id = auth.uid()).
// Callers null-guard already (map-panel, use-chat, use-volunteer-resource).
async function fetchCoords(
  supabase: ReturnType<typeof createClient>
): Promise<{ latitude: number | null; longitude: number | null }> {
  // Time-boxed: a slow SECDEF accessor must never stall auth resolution. On
  // timeout/error, fall back to null coords (callers already null-guard).
  try {
    const { data } = await supabase
      .rpc('get_my_coordinates')
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
    const row = Array.isArray(data) ? data[0] : null
    return {
      latitude: row?.latitude ?? null,
      longitude: row?.longitude ?? null,
    }
  } catch {
    return { latitude: null, longitude: null }
  }
}

// Self-profile is read through the SECDEF accessor get_my_profile() (own-row
// only, WHERE id = auth.uid()). The name-privacy lockdown (#9) revokes direct
// column SELECT on full_name/location_city/location_state from authenticated,
// so the OWNER can no longer read these via the table — the accessor restores
// own-row access. Mirrors the get_my_coordinates pattern. The accessor also
// returns first_name/last_name (new columns) for the owner's own use.
interface OwnProfileRead {
  row: Record<string, unknown> | null
  outcome: Exclude<ProfileReadOutcome, 'superseded'>
  durationMs: number
}

async function fetchOwnProfile(
  supabase: ReturnType<typeof createClient>
): Promise<OwnProfileRead> {
  // Time-boxed: a slow SECDEF accessor must never stall auth resolution. On
  // timeout/error the row is null (never gates loading); the caller keeps the
  // profile it already holds for the same user (lib/profile-read.ts).
  const start = Date.now()
  const signal = AbortSignal.timeout(QUERY_TIMEOUT_MS)
  const failed = (): OwnProfileRead => ({ row: null, outcome: signal.aborted ? 'timeout' : 'error', durationMs: Date.now() - start })
  try {
    const { data, error } = await supabase.rpc('get_my_profile').abortSignal(signal)
    if (error) {
      console.error('Error fetching profile:', error.message, error.code)
      return failed()
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return { row: null, outcome: 'error', durationMs: Date.now() - start }
    return { row: row as Record<string, unknown>, outcome: 'ok', durationMs: Date.now() - start }
  } catch {
    return failed()
  }
}

type SetState<T> = (next: T | ((prev: T) => T)) => void

/**
 * What a finished own-profile read for `userId` does to the in-memory profile: it replaces it, or
 * — when it failed — keeps the profile already loaded for that user (lib/profile-read.ts). A read
 * that lands while a language save for that user is in flight keeps the language on screen, and
 * leaves the origin 'save' so the cookie is not rewritten to the old language.
 */
function applyProfileRead(
  setProfile: SetState<Profile | null>,
  setProfileOrigin: SetState<ProfileOrigin>,
  pending: PendingLanguage | null,
  read: Profile | null,
  userId: string
): void {
  const saving = pending !== null && pending.userId === userId
  setProfile((prev) => withPendingLanguage(nextProfileAfterRead(prev, read, userId), saving ? pending : null))
  setProfileOrigin(saving ? 'save' : 'read')
}

/**
 * The account language save's IO (lib/language-save.ts): a profile in memory to put the language
 * on (read first when there is none), one UPDATE … RETURNING id on the member's own row (an update
 * that matches no row returns no row, and so fails), the language put on the in-memory profile —
 * no re-read, so every surface switches at once — and the cookie once the save has succeeded,
 * only while the save's user is still the one signed in.
 */
export function accountLanguageIo(deps: {
  supabase: Pick<ReturnType<typeof createClient>, 'from'>
  userId: string
  setProfile: SetState<Profile | null>
  setProfileOrigin: SetState<ProfileOrigin>
  ensureProfile: () => Promise<string | null | false>
  isCurrentUser: () => boolean
  pending: { current: PendingLanguage | null }
}): AccountLanguageSaveIo {
  const { supabase, userId, setProfile, setProfileOrigin, pending } = deps
  return {
    ensureProfile: deps.ensureProfile,
    write: (code, signal) =>
      supabase.from('profiles').update({ preferred_language: code }).eq('id', userId).select('id').abortSignal(signal),
    apply: (code) => {
      pending.current = { userId, code }
      setProfile((p) => (p && p.id === userId ? ({ ...p, preferred_language: code } as Profile) : p))
      setProfileOrigin('save')
    },
    remember: (code) => {
      if (isLocale(code) && deps.isCurrentUser()) writeLocaleCookie(code)
    },
  }
}

export function AuthProvider({ children, initialUser = null }: AuthProviderProps) {
  // Seed from the server-trusted identity so a server-authenticated user renders
  // authenticated on the first paint. The full Session/User arrives from the
  // cookie via onAuthStateChange (INITIAL_SESSION) and replaces this seed.
  const [user, setUser] = useState<User | null>(() =>
    initialUser
      ? ({
          id: initialUser.id,
          email: initialUser.email ?? undefined,
          is_anonymous: initialUser.is_anonymous,
        } as unknown as User)
      : null
  )
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileOrigin, setProfileOrigin] = useState<ProfileOrigin>(null)
  // The language save in flight, if any (applyProfileRead keeps its language on screen).
  const pendingLanguageRef = useRef<PendingLanguage | null>(null)
  // The latest profile, for a save started from an older render.
  const profileRef = useRef<Profile | null>(null)
  useEffect(() => {
    profileRef.current = profile
  })
  // The user id whose background profile read last finished (see profileSettled).
  const [profileSettledFor, setProfileSettledFor] = useState<string | null>(null)
  // The user id the latest background profile read is for (null after sign-out). An older read that
  // answers late — another account's — is ignored, so it can never put that account's profile on
  // the current user or change the current user's profileSettled.
  const readForRef = useRef<string | null>(null)
  // Always gate data-fetching until a session is CONFIRMED by
  // onAuthStateChange/reconciliation. The `user` seed (above) lets the shell
  // render authenticated on first paint, while data components gate on `loading`
  // so the first RPCs never fire against a stale/unconfirmed session. Every
  // terminal branch of onAuthStateChange releases the gate via setLoading(false).
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AuthError | null>(null)
  // One-shot guard: reconciliation runs at most once per mount so a follow-up
  // SIGNED_OUT (from the local guest sign-out) cannot re-trigger a refresh loop.
  const reconciledRef = useRef(false)

  // Initialize auth state once on mount.
  //
  // The trusted initial identity comes from the server via the `initialUser`
  // prop (getClaims-verified in layout.tsx), so there is no getSession()-vs-
  // timeout race here. The session token itself is read from the cookie by the
  // browser client, and onAuthStateChange — which emits INITIAL_SESSION on
  // subscribe — resolves the full Session and is the ongoing reconciler that
  // keeps the client identity aligned with the server cookie.
  useEffect(() => {
    const supabase = getSupabase()

    const fetchProfile = async () => {
      // Own-row profile via SECDEF accessor + coords via SECDEF accessor, in parallel.
      const [read, coords] = await Promise.all([
        fetchOwnProfile(supabase),
        fetchCoords(supabase),
      ])
      // Merge coords sourced from SECDEF accessor into the profile object.
      const p = read.row ? (Object.assign({}, read.row, coords) as unknown as Profile) : null
      return { profile: p, outcome: read.outcome, durationMs: read.durationMs }
    }

    // Non-blocking profile load — a slow accessor must never gate `loading`. When it finishes, by
    // any path, the read for `userId` is settled — unless a newer read (or a sign-out) superseded it.
    const loadProfileInBackground = (userId: string, trigger: ProfileReadTrigger) => {
      // A different account (a direct switch, with no sign-out between): the previous account's
      // profile is dropped now, not when this read lands, so no profile reader shows it meanwhile.
      // A re-read for the same user (USER_UPDATED, a reconciled session) keeps the profile — and
      // keeps it when the re-read fails (lib/profile-read.ts).
      if (readForRef.current !== userId) {
        setProfile(null)
        setProfileOrigin('clear')
      }
      readForRef.current = userId
      const current = () => readForRef.current === userId
      fetchProfile()
        .then((r) => {
          if (!current()) {
            logProfileRead(trigger, 'superseded', r.profile, r.durationMs)
            return
          }
          applyProfileRead(setProfile, setProfileOrigin, pendingLanguageRef.current, r.profile, userId)
          logProfileRead(trigger, r.outcome, r.profile, r.durationMs)
        })
        .catch(() => {
          // A read that throws keeps the profile, as a failed one does.
          logProfileRead(trigger, 'error', null, 0)
        })
        .finally(() => {
          if (current()) setProfileSettledFor(userId)
        })
    }

    const mountTime = Date.now()

    // Bounded safety valve: the ONLY upper bound on `loading`. If session
    // resolution stalls (expired anon token, hung token-refresh/network), release
    // the data gate after 10s so the spinner is never permanent. Cleared on first
    // resolution (below) and on unmount so it never fights a normal resolution.
    // This is a pure upper-bound timer — not a getSession()-vs-timeout race.
    const valve = setTimeout(() => {
      setLoading((c) => {
        if (c) logger.warn('auth.safetyValve', { bound_ms: 10000 })
        return false
      })
      // No auth event resolved, so no profile read ever ran for the server-seeded user: count its
      // (absent) profile as settled, so profile-gated UI (the feed's announcements) is not silent
      // all session. A read started later by an auth event still applies its profile.
      setProfileSettledFor(initialUser?.id ?? null)
    }, 10000)
    const clearValve = () => clearTimeout(valve)

    // Listen for auth changes (single listener for the whole app). This also
    // delivers the initial session (INITIAL_SESSION) from the cookie.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        logger.info('auth.stateChange', { event, hasSession: !!newSession })

        const clientUser = newSession?.user ?? null
        const clientAnon = isAnonymousUser(clientUser)

        // RECONCILIATION GUARD (core fix): a real server cookie exists
        // (initialUser) but the client's resolved session is anonymous/guest,
        // absent, or a different user → the client is on a stale session behind
        // the authenticated server cookie. Re-read the authoritative cookie via
        // refreshSession(); if it still diverges, drop the guest locally so the
        // client re-adopts the server session. Runs at most once per mount.
        const diverged =
          !!initialUser &&
          (clientUser === null || clientAnon || clientUser.id !== initialUser.id)

        if (diverged && !reconciledRef.current) {
          reconciledRef.current = true
          logger.warn('auth.session.divergence', {
            clientSub: clientUser?.id ?? null,
            serverSub: initialUser!.id,
            clientAnon,
          })

          const { data: { session: refreshed } } = await supabase.auth.refreshSession()

          if (
            refreshed?.user &&
            !isAnonymousUser(refreshed.user) &&
            refreshed.user.id === initialUser!.id
          ) {
            // The client adopted the server-trusted session from the cookie.
            setUser(refreshed.user)
            setSession(refreshed)
            clearValve()
            setLoading(false)
            loadProfileInBackground(refreshed.user.id, 'reconcile')
          } else {
            // Still divergent — clear only the local guest session (scope:'local'
            // leaves other sessions intact) so the client re-adopts the server
            // session; the follow-up auth event carries the corrected state.
            await supabase.auth.signOut({ scope: 'local' })
            clearValve()
            setLoading(false)
          }
          logger.info('auth.ready', { duration_ms: Date.now() - mountTime, isAuthenticated: !!initialUser })
          return
        }

        if (clientUser) {
          reconciledRef.current = true
          setUser(clientUser)
          setSession(newSession)
          // Session is set — the app can render authenticated now. Profile is
          // fetched non-blocking below and never gates loading.
          clearValve()
          setLoading(false)

          // Only fetch profile on events that indicate a new/changed user.
          // TOKEN_REFRESHED fires every ~hour and doesn't change the user —
          // re-fetching the profile on each refresh is unnecessary DB load.
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            loadProfileInBackground(clientUser.id, event)
          }
        } else {
          // Signed out: a profile read still running for the previous user is dropped, and nothing
          // counts as settled (the same account signing back in waits for its new read).
          readForRef.current = null
          setProfileSettledFor(null)
          setUser(null)
          setSession(null)
          setProfile(null)
          setProfileOrigin('clear')
          clearValve()
          setLoading(false)
        }

        logger.info('auth.ready', { duration_ms: Date.now() - mountTime, isAuthenticated: !!newSession?.user })
      }
    )

    return () => {
      clearValve()
      subscription.unsubscribe()
    }
  }, []) // Empty deps - runs once on mount

  // Sign out
  const signOut = useCallback(async () => {
    const { error } = await getSupabase().auth.signOut()
    if (error) {
      setError(error)
    }
  }, [])

  // Refresh session
  const refreshSession = useCallback(async () => {
    const supabase = getSupabase()
    const { data: { session: newSession }, error } = await supabase.auth.refreshSession()
    if (error) {
      setError(error)
    } else if (newSession) {
      // Own-row profile + coords via SECDEF accessors, in parallel.
      const [read, coords] = await Promise.all([
        fetchOwnProfile(supabase),
        fetchCoords(supabase),
      ])
      const profileData = read.row ? (Object.assign({}, read.row, coords) as unknown as Profile) : null
      logProfileRead('refresh', read.outcome, profileData, read.durationMs)
      setUser(newSession.user)
      setSession(newSession)
      applyProfileRead(setProfile, setProfileOrigin, pendingLanguageRef.current, profileData, newSession.user.id)
    }
  }, [])

  // Update profile
  const updateProfile = useCallback(async (updates: ProfileUpdate) => {
    if (!user) return

    const supabase = getSupabase()
    // UPDATE...RETURNING cannot include the privacy-revoked columns
    // (full_name/location_city/location_state). Update without RETURNING those,
    // then re-read the own-row profile through the SECDEF accessor.
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
    if (error) {
      throw error
    }

    const [read, coords] = await Promise.all([
      fetchOwnProfile(supabase),
      fetchCoords(supabase),
    ])
    const profileData = read.row ? (Object.assign({}, read.row, coords) as unknown as Profile) : null
    logProfileRead('update', read.outcome, profileData, read.durationMs)
    applyProfileRead(setProfile, setProfileOrigin, pendingLanguageRef.current, profileData, user.id)
  }, [user])

  // Save the account language (lib/language-save.ts): the in-memory profile — and with it every
  // surface's locale — takes the new language at once and gives it back if the write fails, times
  // out or updates no row. The cookie is written only when the save has succeeded.
  const saveLanguage = useCallback(async (code: string): Promise<LanguageSaveOutcome> => {
    const uid = user?.id
    if (!uid) return 'error'
    const supabase = getSupabase()
    const ensureProfile = async (): Promise<string | null | false> => {
      const held = profileRef.current
      if (held && held.id === uid) return (held as { preferred_language?: string | null }).preferred_language ?? null
      // No profile in memory (its read failed or has not answered): read it now. Without one the
      // screen cannot show the new language, so the save stops here with nothing written.
      const [read, coords] = await Promise.all([fetchOwnProfile(supabase), fetchCoords(supabase)])
      const loaded = read.row ? (Object.assign({}, read.row, coords) as unknown as Profile) : null
      logProfileRead('language_save', read.outcome, loaded, read.durationMs)
      if (!loaded || readForRef.current !== uid) return false
      applyProfileRead(setProfile, setProfileOrigin, null, loaded, uid)
      return (loaded as { preferred_language?: string | null }).preferred_language ?? null
    }
    try {
      return await saveAccountLanguage(
        accountLanguageIo({
          supabase,
          userId: uid,
          setProfile,
          setProfileOrigin,
          ensureProfile,
          isCurrentUser: () => readForRef.current === uid,
          pending: pendingLanguageRef,
        }),
        code
      )
    } finally {
      if (pendingLanguageRef.current?.userId === uid) pendingLanguageRef.current = null
    }
  }, [user])

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    error,
    isAuthenticated: !!user,
    // is_anonymous is a first-class field on the Supabase User object (supabase-js 2.105+).
    // Cast through unknown because the generated types may not include it yet.
    isAnonymous: (user as unknown as { is_anonymous?: boolean })?.is_anonymous ?? false,
    // Keyed by user id, so a new user (sign-in, account switch) reads false until its own read ends.
    profileSettled: user !== null && profileSettledFor === user.id,
    profileOrigin,
    signOut,
    refreshSession,
    updateProfile,
    saveLanguage,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
