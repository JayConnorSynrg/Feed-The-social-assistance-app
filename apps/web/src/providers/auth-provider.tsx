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

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AuthError | null>(null)

  const supabase = createClient()

  // Fetch user profile
  const fetchProfile = useCallback(async (userId: string) => {
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
  }, [supabase])

  // Initialize auth state
  useEffect(() => {
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
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
  }, [supabase, fetchProfile])

  // Sign out
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setError(error)
    }
  }, [supabase])

  // Refresh session
  const refreshSession = useCallback(async () => {
    const { data: { session: newSession }, error } = await supabase.auth.refreshSession()
    if (error) {
      setError(error)
    } else if (newSession) {
      const userProfile = await fetchProfile(newSession.user.id)
      setUser(newSession.user)
      setSession(newSession)
      setProfile(userProfile)
    }
  }, [supabase, fetchProfile])

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return

    const { data, error } = await supabase
      .from('profiles')
      .update(updates as never)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    setProfile(data as Profile)
  }, [supabase, user])

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
