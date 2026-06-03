'use client'

/**
 * Vault Guard
 *
 * Component that automatically shows the vault unlock/setup modal when needed.
 * Wraps components that require encrypted data access.
 *
 * Props:
 *   children  — content that requires vault access
 *   fallback  — optional custom locked-state placeholder
 *   onDismiss — called when the user dismisses the modal without unlocking/
 *               setting up (e.g. Cancel). Providing this makes the modal
 *               dismissible; omitting it keeps the modal non-dismissible
 *               (legacy behaviour, used when vault access is strictly required).
 */

import { useState } from 'react'
import { useVault } from '@/contexts/vault-context'
import { VaultUnlockModal } from './vault-unlock-modal'
import { Loader2 } from 'lucide-react'

interface VaultGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  /**
   * When provided the modal Cancel/✕ button is active and calls onDismiss.
   * Use this for contexts where vault access is optional (e.g. upload flows).
   * Omit to keep the non-dismissible behaviour for required-vault surfaces
   * (form wizard, PDF annotator).
   */
  onDismiss?: () => void
}

export function VaultGuard({ children, fallback, onDismiss }: VaultGuardProps) {
  const { isUnlocked, isSetup, loading } = useVault()
  // Track whether the user has explicitly dismissed the modal this render cycle.
  // Resets if vault state changes (e.g. user sets up vault in another tab).
  const [dismissed, setDismissed] = useState(false)

  // Show loading state only for the INITIAL vault status check (before we know
  // if the vault is locked or unlocked). Once isUnlocked is known, keep the
  // VaultUnlockModal mounted even during loading — otherwise an unlock attempt
  // (which sets loading=true) will unmount the modal and destroy its local
  // password state, leaving the submit button permanently disabled after the
  // operation completes (password='' → disabled). The modal handles loading
  // itself by disabling inputs and showing a spinner on the submit button.
  if (loading && !isUnlocked && !isSetup) {
    return (
      <>
        {fallback || (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </>
    )
  }

  // Vault is unlocked — render children
  if (isUnlocked) {
    return <>{children}</>
  }

  // Vault locked or not yet set up.
  // The modal title/copy is driven by isSetup inside VaultUnlockModal:
  //   isSetup===false → "Set Up Your Vault" (setup mode)
  //   isSetup===true  → "Unlock Your Vault" (unlock mode)
  const handleDismiss = onDismiss
    ? (open: boolean) => {
        if (!open) {
          setDismissed(true)
          onDismiss()
        }
      }
    : undefined

  // If onDismiss was provided and user already dismissed, show fallback/placeholder.
  if (dismissed) {
    return (
      <>
        {fallback || (
          <div className="flex items-center justify-center p-8 text-center">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {isSetup
                  ? 'Unlock your vault to access encrypted data.'
                  : 'Set up your vault to encrypt and store sensitive data.'}
              </p>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <VaultUnlockModal
        open={!dismissed}
        onOpenChange={
          handleDismiss ??
          (() => {
            // No onDismiss provided — modal stays open until vault is unlocked.
          })
        }
      />
      {fallback || (
        <div className="flex items-center justify-center p-8 text-center">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {isSetup
                ? 'Your vault is locked. Unlock it to view encrypted data.'
                : 'Set up your vault to access encrypted features.'}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
