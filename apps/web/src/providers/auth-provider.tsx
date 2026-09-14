'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import type { Profile, Database } from '@feed/database'
import { logger } from '@/lib/logger'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'

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
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  updateProfile: (updates: ProfileUpdate) => Promise<void>
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
async function fetchOwnProfile(
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, unknown> | null> {
  // Time-boxed: a slow SECDEF accessor must never stall auth resolution. On
  // timeout/error, fall back to a null profile (never gates loading).
  try {
    const { data, error } = await supabase
      .rpc('get_my_profile')
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
    if (error) {
      console.error('Error fetching profile:', error.message, error.code)
      return null
    }
    const row = Array.isArray(data) ? data[0] : data
    return (row as Record<string, unknown>) ?? null
  } catch {
    return null
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
      const [data, coords] = await Promise.all([
        fetchOwnProfile(supabase),
        fetchCoords(supabase),
      ])
      if (!data) return null
      // Merge coords sourced from SECDEF accessor into the profile object.
      return Object.assign({}, data, coords) as unknown as Profile
    }

    // Non-blocking profile load — a slow accessor must never gate `loading`.
    const loadProfileInBackground = () => {
      fetchProfile()
        .then((p) => setProfile(p))
        .catch(() => setProfile(null))
    }

    const mountTime = Date.now()

    // Bounded safety valve: the ONLY upper bound on `loading`. If session
    // resolution stalls (expired anon token, hung token-refresh/network), release
    // the data gate after 10s so the spinner is never permanent. Cleared on first
    // resolution (below) and on unmount so it never fights a normal resolution.
    // This is a pure upper-bound timer — not a getSession()-vs-timeout race.
    const valve = setTimeout(
      () => setLoading((c) => {
        if (c) logger.warn('auth.safetyValve', { bound_ms: 10000 })
        return false
      }),
      10000
    )
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
            loadProfileInBackground()
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
            loadProfileInBackground()
          }
        } else {
          setUser(null)
          setSession(null)
          setProfile(null)
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
      const [data, coords] = await Promise.all([
        fetchOwnProfile(supabase),
        fetchCoords(supabase),
      ])
      const profileData = data ? Object.assign({}, data, coords) : null
      setUser(newSession.user)
      setSession(newSession)
      setProfile(profileData as unknown as Profile)
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

    const [data, coords] = await Promise.all([
      fetchOwnProfile(supabase),
      fetchCoords(supabase),
    ])
    setProfile(Object.assign({}, data ?? {}, coords) as unknown as Profile)
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
    signOut,
    refreshSession,
    updateProfile,
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
