'use client'

/**
 * Vault Guard
 *
 * Component that automatically shows the vault unlock modal when needed.
 * Wraps components that require encrypted data access.
 */

import { type ReactNode } from 'react'
import { useVault } from '@/contexts/vault-context'
import { VaultUnlockModal } from './vault-unlock-modal'
import { Loader2 } from 'lucide-react'

interface VaultGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

export function VaultGuard({ children, fallback }: VaultGuardProps) {
  const { isUnlocked, loading } = useVault()

  // showUnlockModal is purely derived from vault state — compute during render,
  // no effect needed.
  const showUnlockModal = !loading && !isUnlocked

  // Show loading state
  if (loading) {
    return (
      fallback || (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )
    )
  }

  // Show unlock modal if needed
  if (!isUnlocked) {
    return (
      <>
        <VaultUnlockModal
          open={showUnlockModal}
          onOpenChange={() => {
            // Modal stays open until vault is unlocked; dismissal is a no-op.
          }}
        />
        {fallback || (
          <div className="flex items-center justify-center p-8 text-center">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Your vault is locked. Unlock it to view encrypted data.
              </p>
            </div>
          </div>
        )}
      </>
    )
  }

  // Vault is unlocked - render children
  return <>{children}</>
}
