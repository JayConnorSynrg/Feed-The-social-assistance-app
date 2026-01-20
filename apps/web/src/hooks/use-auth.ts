'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import type { Profile } from '@feed/database'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: AuthError | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  })

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
          const profile = await fetchProfile(session.user.id)
          setState({
            user: session.user,
            session,
            profile,
            loading: false,
            error: null,
          })
        } else {
          setState({
            user: null,
            session: null,
            profile: null,
            loading: false,
            error: null,
          })
        }
      } catch (err) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: err as AuthError,
        }))
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          setState({
            user: session.user,
            session,
            profile,
            loading: false,
            error: null,
          })
        } else {
          setState({
            user: null,
            session: null,
            profile: null,
            loading: false,
            error: null,
          })
        }
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
      setState(prev => ({ ...prev, error }))
    }
  }, [supabase])

  // Refresh session
  const refreshSession = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.refreshSession()
    if (error) {
      setState(prev => ({ ...prev, error }))
    } else if (session) {
      const profile = await fetchProfile(session.user.id)
      setState({
        user: session.user,
        session,
        profile,
        loading: false,
        error: null,
      })
    }
  }, [supabase, fetchProfile])

  return {
    ...state,
    signOut,
    refreshSession,
    isAuthenticated: !!state.user,
  }
}

// Hook for just the user
export function useUser() {
  const { user, loading, error } = useAuth()
  return { user, loading, error }
}

// Hook for just the session
export function useSession() {
  const { session, loading, error, refreshSession } = useAuth()
  return { session, loading, error, refreshSession }
}

// Hook for checking auth status
export function useIsAuthenticated() {
  const { isAuthenticated, loading } = useAuth()
  return { isAuthenticated, loading }
}
