'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import type { Profile, Database } from '@feed/database'
import { logger } from '@/lib/logger'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: AuthError | null
  isAuthenticated: boolean
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

interface AuthProviderProps {
  children: ReactNode
}

// ─── coord helper ───────────────────────────────────────────────────────────
// latitude/longitude are REVOKED from direct column SELECT (coord-read lockdown,
// migration 20260606130000). We fetch them via the SECDEF accessor get_my_coordinates()
// which enforces own-row access only (WHERE id = auth.uid()).
// Callers null-guard already (map-panel, use-chat, use-volunteer-resource).
async function fetchCoords(
  supabase: ReturnType<typeof createClient>
): Promise<{ latitude: number | null; longitude: number | null }> {
  const { data } = await supabase.rpc('get_my_coordinates')
  const row = Array.isArray(data) ? data[0] : null
  return {
    latitude: row?.latitude ?? null,
    longitude: row?.longitude ?? null,
  }
}

// 12-column list — excludes latitude, longitude (coord lockdown), phone,
// paypal_email, venmo_username, is_admin (PII hardening, 20260603120000).
// user_role added: has column-level SELECT grant (safe to read); unblocks role-gated UI.
const PROFILE_COLUMNS =
  'id, username, full_name, avatar_url, bio, location_city, location_state, ' +
  'is_verified, created_at, is_staff, onboarding_completed, user_role'

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AuthError | null>(null)

  // Initialize auth state once on mount
  useEffect(() => {
    const supabase = getSupabase()

    const fetchProfile = async (userId: string) => {
      // Run profile select and coord RPC in parallel to avoid an extra round-trip.
      const [profileResult, coords] = await Promise.all([
        supabase
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('id', userId)
          .maybeSingle(),
        fetchCoords(supabase),
      ])

      const { data, error } = profileResult
      if (error) {
        console.error('Error fetching profile:', error.message, error.code)
        return null
      }
      if (!data) return null
      // Merge coords sourced from SECDEF accessor into the profile object.
      return Object.assign({}, data, coords) as unknown as Profile
    }

    const mountTime = Date.now()

    const initAuth = async () => {
      try {
        // Race getSession() against a 5-second timeout. getSession() acquires
        // a navigator lock internally; under React Strict Mode's double-mount
        // the lock can stall for several seconds (lock steal after 5s). If it
        // exceeds our timeout, keep loading=true and let the onAuthStateChange
        // listener resolve auth state when the session is eventually available.
        const getSessionStart = Date.now()
        logger.info('auth.getSession.start')
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ])

        if (sessionResult && 'data' in sessionResult) {
          const { data: { session }, error } = sessionResult
          if (error) throw error

          logger.info('auth.getSession.resolved', { duration_ms: Date.now() - getSessionStart, hasSession: !!session })

          if (session?.user) {
            const userProfile = await fetchProfile(session.user.id)
            setUser(session.user)
            setSession(session)
            setProfile(userProfile)
          }
          // Session resolved (user or no user) — done loading
          setLoading(false)
          logger.info('auth.ready', { duration_ms: Date.now() - mountTime, isAuthenticated: !!session?.user })
        } else {
          // Timed out — keep loading=true so the UI shows a loading state
          // instead of falsely rendering as unauthenticated. The
          // onAuthStateChange listener will set loading=false once the
          // session resolves.
          logger.warn('auth.getSession.timeout', { timeout_ms: 5000 })
        }
      } catch (err) {
        setError(err as AuthError)
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes (single listener for the whole app)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        logger.info('auth.stateChange', { event, hasSession: !!newSession })
        if (newSession?.user) {
          setUser(newSession.user)
          setSession(newSession)

          // Only fetch profile on events that indicate a new/changed user.
          // TOKEN_REFRESHED fires every ~hour and doesn't change the user —
          // re-fetching the profile on each refresh is unnecessary DB load.
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            const userProfile = await fetchProfile(newSession.user.id)
            setProfile(userProfile)
          }
        } else {
          setUser(null)
          setSession(null)
          setProfile(null)
        }
        setLoading(false)
        logger.info('auth.ready', { duration_ms: Date.now() - mountTime, isAuthenticated: !!newSession?.user })
      }
    )

    // Safety valve: if loading is still true after 10s (getSession timed out
    // at 5s AND onAuthStateChange hasn't fired), force loading=false so the
    // UI isn't stuck on a spinner indefinitely. The user will appear
    // unauthenticated, but can manually refresh or log in.
    const maxLoadingTimer = setTimeout(() => {
      setLoading((current) => {
        if (current) {
          logger.warn('auth.safetyValve', { totalWait_ms: 10000 })
        }
        return false
      })
    }, 10_000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(maxLoadingTimer)
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
      // Run profile select and coord RPC in parallel.
      const [profileResult, coords] = await Promise.all([
        supabase
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('id', newSession.user.id)
          .maybeSingle(),
        fetchCoords(supabase),
      ])
      const profileData = profileResult.data
        ? Object.assign({}, profileResult.data, coords)
        : null
      setUser(newSession.user)
      setSession(newSession)
      setProfile(profileData as unknown as Profile)
    }
  }, [])

  // Update profile
  const updateProfile = useCallback(async (updates: ProfileUpdate) => {
    if (!user) return

    const supabase = getSupabase()
    // UPDATE...RETURNING cannot include revoked columns — run profile update
    // and coord RPC in parallel, then merge.
    const [updateResult, coords] = await Promise.all([
      supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select(PROFILE_COLUMNS)
        .single(),
      fetchCoords(supabase),
    ])

    const { data, error } = updateResult
    if (error) {
      throw error
    }

    setProfile(Object.assign({}, data, coords) as unknown as Profile)
  }, [user])

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    error,
    isAuthenticated: !!user,
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
