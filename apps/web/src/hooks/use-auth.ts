'use client'

// Re-export useAuthContext as useAuth for backwards compatibility.
// All auth state is now managed by AuthProvider (single subscription, single profile fetch).
// Previously, each component calling useAuth() created its own Supabase subscription + profile fetch.

import { useAuthContext } from '@/providers/auth-provider'

export function useAuth() {
  return useAuthContext()
}

// Convenience hooks
export function useUser() {
  const { user, loading, error } = useAuth()
  return { user, loading, error }
}

export function useSession() {
  const { session, loading, error, refreshSession } = useAuth()
  return { session, loading, error, refreshSession }
}

export function useIsAuthenticated() {
  const { isAuthenticated, loading } = useAuth()
  return { isAuthenticated, loading }
}
