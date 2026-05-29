'use client'

/**
 * Vault Guard
 *
 * Component that automatically shows the vault unlock modal when needed.
 * Wraps components that require encrypted data access.
 */

import { useState, useEffect, type ReactNode } from 'react'
import { useVault } from '@/contexts/vault-context'
import { VaultUnlockModal } from './vault-unlock-modal'
import { Loader2 } from 'lucide-react'

interface VaultGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

export function VaultGuard({ children, fallback }: VaultGuardProps) {
  const { isUnlocked, loading } = useVault()
  const [showUnlockModal, setShowUnlockModal] = useState(false)

  // Show setup/unlock modal whenever the vault is not unlocked (covers both
  // new users with no vault and returning users whose vault is locked).
  // VaultUnlockModal auto-selects setup vs unlock mode from isSetup internally.
  useEffect(() => {
    if (!loading && !isUnlocked) {
      setShowUnlockModal(true)
    }
  }, [loading, isUnlocked])

  // Close modal when vault is unlocked
  useEffect(() => {
    if (isUnlocked) {
      setShowUnlockModal(false)
    }
  }, [isUnlocked])

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
          onOpenChange={setShowUnlockModal}
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
