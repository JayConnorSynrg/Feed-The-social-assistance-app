'use client'

import { AuthProvider } from '@/providers/auth-provider'
import { VaultProvider } from '@/contexts/vault-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <VaultProvider>
        {children}
      </VaultProvider>
    </AuthProvider>
  )
}
