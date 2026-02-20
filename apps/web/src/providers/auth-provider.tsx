'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import type { Profile } from '@feed/database'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: AuthError | null
  isAuthenticated: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }
      return data as Profile
    }

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error

        if (session?.user) {
          const userProfile = await fetchProfile(session.user.id)
          setUser(session.user)
          setSession(session)
          setProfile(userProfile)
        }
      } catch (err) {
        setError(err as AuthError)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes (single listener for the whole app)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (newSession?.user) {
          const userProfile = await fetchProfile(newSession.user.id)
          setUser(newSession.user)
          setSession(newSession)
          setProfile(userProfile)
        } else {
          setUser(null)
          setSession(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
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
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', newSession.user.id)
        .single()
      setUser(newSession.user)
      setSession(newSession)
      setProfile(profileData as Profile)
    }
  }, [])

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return

    const { data, error } = await getSupabase()
      .from('profiles')
      .update(updates as never)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    setProfile(data as Profile)
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
