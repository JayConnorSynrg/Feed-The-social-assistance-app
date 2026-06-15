'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface AdminOrg {
  id: string
  name: string
  org_type: string
}

export function useAdminOrgs() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.rpc as any)('get_admin_org_list')
      .then(({ data, error }: { data: AdminOrg[] | null; error: unknown }) => {
        if (!error && data) setOrgs(data)
        setLoading(false)
      })
  }, [])

  return { orgs, loading }
}
