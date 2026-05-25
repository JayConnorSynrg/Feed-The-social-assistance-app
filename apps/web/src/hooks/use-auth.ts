'use client'

// Re-export useAuthContext as useAuth for backwards compatibility.
// All auth state is now managed by AuthProvider (single subscription, single profile fetch).
// Previously, each component calling useAuth() created its own Supabase subscription + profile fetch.

import { useAuthContext } from '@/providers/auth-provider'

export function useAuth() {
  return useAuthContext()
}
