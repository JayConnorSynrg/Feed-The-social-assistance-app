'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export interface AdminOrg {
  id: string
  name: string
  org_type: string
}

export function useAdminOrgs() {
  const { loading: authLoading } = useAuth()
  const [orgs, setOrgs] = useState<AdminOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Wait for auth to reconcile before the RPC so it runs against the reconciled
    // session. This is an admin-only surface (route-gated), so no guest concern.
    if (authLoading) return

    const supabase = createClient()
    setError(null)
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
        } else if (data) {
          setOrgs(data)
        }
        setLoading(false)
      })
  }, [authLoading])

  return { orgs, loading, error }
}
