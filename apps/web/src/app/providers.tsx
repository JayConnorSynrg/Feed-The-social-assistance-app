'use client'

import { useEffect } from 'react'
import { AuthProvider, type InitialUser } from '@/providers/auth-provider'
import { VaultProvider } from '@/contexts/vault-context'
import { installClientErrorCapture } from '@/lib/client-error-capture'

export function Providers({
  children,
  initialUser = null,
}: {
  children: React.ReactNode
  initialUser?: InitialUser | null
}) {
  // One app-wide capture for uncaught errors + unhandled rejections -> app_logs.
  useEffect(() => installClientErrorCapture(window), [])

  return (
    <AuthProvider initialUser={initialUser}>
      <VaultProvider>
        {children}
      </VaultProvider>
    </AuthProvider>
  )
}
