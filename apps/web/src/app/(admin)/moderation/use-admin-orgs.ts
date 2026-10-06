'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export interface AdminOrg {
  id: string
  name: string
  org_type: string
}

/**
 * The orgs the caller administers (get_admin_org_list). `enabled: false` skips the call entirely —
 * the organization admin page passes it so a screen scoped to one org never reads the others.
 */
export function useAdminOrgs({ enabled = true }: { enabled?: boolean } = {}) {
  const { loading: authLoading } = useAuth()
  const [orgs, setOrgs] = useState<AdminOrg[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    // Wait for auth to reconcile before the RPC so it runs against the reconciled
    // session. This is an admin-only surface (route-gated), so no guest concern.
    if (authLoading) return

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.rpc as any)('get_admin_org_list')
      .then(({ data, error: rpcError }: { data: AdminOrg[] | null; error: unknown }) => {
        if (rpcError) {
          // Surface the failure instead of silently rendering an empty org list.
          const message =
            rpcError instanceof Error
              ? rpcError.message
              : 'Failed to load admin organizations'
          setError(message)
        } else {
          // Clear any stale error from a prior fetch on the success path.
          setError(null)
          if (data) {
            setOrgs(data)
          }
        }
        setLoading(false)
      })
  }, [authLoading, enabled])

  return { orgs, loading, error }
}
