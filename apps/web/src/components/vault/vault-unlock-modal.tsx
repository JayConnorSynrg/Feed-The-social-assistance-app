'use client'

/**
 * Vault Unlock Modal
 *
 * Modal that appears when user needs to unlock their vault to access encrypted data.
 * Supports both initial setup and unlock flows.
 */

import { useState } from 'react'
import { useVault } from '@/contexts/vault-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Lock, AlertTriangle } from 'lucide-react'

interface VaultUnlockModalProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  mode?: 'setup' | 'unlock'
  onSuccess?: () => void
}

export function VaultUnlockModal({
  open,
  onOpenChange,
  mode: initialMode,
  onSuccess,
}: VaultUnlockModalProps) {
  const { isSetup, setup, unlock, loading, error, clearError } = useVault()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showWarning, setShowWarning] = useState(true)

  // Determine mode based on setup status
  const mode = initialMode || (isSetup ? 'unlock' : 'setup')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (mode === 'setup') {
      // Validate password confirmation
      if (password !== confirmPassword) {
        // Handle mismatch - could use a local error state
        return
      }

      if (password.length < 12) {
        // Handle weak password
        return
      }

      try {
        await setup(password)
        setPassword('')
        setConfirmPassword('')
        onSuccess?.()
        onOpenChange?.(false)
      } catch (err) {
        // Error is handled by context
      }
    } else {
      try {
        const success = await unlock(password)
        if (success) {
          setPassword('')
          onSuccess?.()
          onOpenChange?.(false)
        }
      } catch (err) {
        // Error is handled by context
      }
    }
  }

  const handleClose = () => {
    if (!loading) {
      setPassword('')
      setConfirmPassword('')
      clearError()
      onOpenChange?.(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <DialogTitle>
              {mode === 'setup' ? 'Set Up Your Vault' : 'Unlock Your Vault'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {mode === 'setup'
              ? 'Create a master password to encrypt your sensitive data.'
              : 'Enter your master password to access your encrypted data.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {mode === 'setup' && showWarning && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> If you forget this password, your encrypted data cannot be recovered.
                  Please store it in a secure password manager.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Master Password</Label>
              <Input
                id="password"
                type="password"
                placeholder={mode === 'setup' ? 'Create a strong password' : 'Enter your master password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                minLength={mode === 'setup' ? 12 : undefined}
                autoComplete="off"
              />
              {mode === 'setup' && (
                <p className="text-sm text-muted-foreground">
                  Minimum 12 characters. Use a mix of letters, numbers, and symbols.
                </p>
              )}
            </div>

            {mode === 'setup' && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="off"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-sm text-destructive">
                    Passwords do not match
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                !password ||
                (mode === 'setup' && password !== confirmPassword) ||
                (mode === 'setup' && password.length < 12)
              }
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'setup' ? 'Create Vault' : 'Unlock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
