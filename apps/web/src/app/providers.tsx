'use client'

import { AuthProvider, type InitialUser } from '@/providers/auth-provider'
import { VaultProvider } from '@/contexts/vault-context'

export function Providers({
  children,
  initialUser = null,
}: {
  children: React.ReactNode
  initialUser?: InitialUser | null
}) {
  return (
    <AuthProvider initialUser={initialUser}>
      <VaultProvider>
        {children}
      </VaultProvider>
    </AuthProvider>
  )
}
