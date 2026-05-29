'use client'

/**
 * Vault Context
 *
 * React context that provides vault state and operations throughout the app.
 * Manages the unlock/lock state and provides encryption/decryption helpers.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuthContext } from '@/providers/auth-provider'
import {
  setupVault,
  unlockVault,
  lockVault,
  isVaultUnlocked,
  hasVault,
  changeMasterPassword,
  encryptField,
  decryptField,
  encryptFields,
  decryptFields,
} from '@/lib/vault'
import { clearKeys } from '@/lib/key-store'
import { migrateUserDataToEncrypted, needsMigration } from '@/lib/migrate-to-encrypted'
import { logPredefinedEvent } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'

interface VaultContextType {
  // State
  isUnlocked: boolean
  isSetup: boolean
  loading: boolean
  error: string | null

  // Actions
  setup: (masterPassword: string) => Promise<void>
  unlock: (masterPassword: string) => Promise<boolean>
  lock: () => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>

  // Encryption helpers
  encrypt: (plaintext: string) => Promise<{ ciphertext: string; iv: string }>
  decrypt: (ciphertext: string, iv: string) => Promise<string>
  encryptMultiple: (fields: Record<string, string>) => Promise<Record<string, { ciphertext: string; iv: string }>>
  decryptMultiple: (fields: Record<string, { ciphertext: string; iv: string }>) => Promise<Record<string, string>>

  // Utilities
  clearError: () => void
  refresh: () => Promise<void>
}

const VaultContext = createContext<VaultContextType | undefined>(undefined)

interface VaultProviderProps {
  children: ReactNode
}

export function VaultProvider({ children }: VaultProviderProps) {
  const { user, isAuthenticated } = useAuthContext()
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [isSetup, setIsSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check vault status on mount and when user changes
  useEffect(() => {
    const checkVaultStatus = async () => {
      if (!user?.id) {
        setIsUnlocked(false)
        setIsSetup(false)
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Check if vault is set up
        const vaultExists = await hasVault(user.id)
        setIsSetup(vaultExists)

        // Check if vault is unlocked
        if (vaultExists) {
          const unlocked = await isVaultUnlocked(user.id)
          setIsUnlocked(unlocked)
        } else {
          setIsUnlocked(false)
        }
      } catch (err) {
        console.error('Error checking vault status:', err)
        setError(err instanceof Error ? err.message : 'Failed to check vault status')
        setIsUnlocked(false)
        setIsSetup(false)
      } finally {
        setLoading(false)
      }
    }

    checkVaultStatus()

    // Safety valve: if a vault check hangs (hasVault / isVaultUnlocked never
    // resolves), loading would stick true forever and block the UI. After 10s
    // force loading=false. On the happy path the finally block above clears
    // loading first, so this timer becomes a no-op (current === false).
    const maxLoadingTimer = setTimeout(() => {
      setLoading((current) => {
        if (current) {
          logger.warn('vault.safetyValve', { totalWait_ms: 10000, userId: user?.id })
        }
        return false
      })
    }, 10_000)

    return () => {
      clearTimeout(maxLoadingTimer)
    }
  }, [user?.id])

  // Lock vault on logout
  useEffect(() => {
    if (!isAuthenticated) {
      lockVault().catch(console.error)
      setIsUnlocked(false)
    }
  }, [isAuthenticated])

  // Setup vault for first-time users
  const setup = useCallback(async (masterPassword: string) => {
    if (!user?.id) {
      throw new Error('User not authenticated')
    }

    try {
      setLoading(true)
      setError(null)
      await setupVault(masterPassword, user.id)
      setIsSetup(true)
      setIsUnlocked(true)

      // Log vault setup event
      logPredefinedEvent('VAULT_SETUP', {
        action: 'setup',
        resourceType: 'vault',
        resourceId: user.id,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to setup vault'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Unlock vault with master password
  const unlock = useCallback(async (masterPassword: string): Promise<boolean> => {
    if (!user?.id) {
      throw new Error('User not authenticated')
    }

    try {
      setLoading(true)
      setError(null)
      const success = await unlockVault(masterPassword, user.id)
      setIsUnlocked(success)

      if (!success) {
        setError('Incorrect password')

        // Log failed unlock attempt
        logPredefinedEvent('VAULT_UNLOCK_FAILED', {
          action: 'unlock',
          resourceType: 'vault',
          resourceId: user.id,
          details: { reason: 'incorrect_password' },
        })

        return false
      }

      // Log successful vault unlock
      logPredefinedEvent('VAULT_UNLOCK', {
        action: 'unlock',
        resourceType: 'vault',
        resourceId: user.id,
      })

      // After successful unlock, check if user needs data migration
      // This automatically migrates plaintext data to encrypted columns
      try {
        const shouldMigrate = await needsMigration(user.id)
        if (shouldMigrate) {
          console.log('Migrating user data to encrypted storage...')
          const migrationResult = await migrateUserDataToEncrypted(user.id)

          if (migrationResult.errors.length > 0) {
            console.error('Migration completed with errors:', migrationResult.errors)
          } else {
            console.log('Migration completed successfully:', {
              profiles: migrationResult.migratedProfiles,
              submissions: migrationResult.migratedSubmissions,
            })

            // Log successful migration
            logPredefinedEvent('DATA_MIGRATION', {
              action: 'update',
              resourceType: 'user_data',
              resourceId: user.id,
              details: {
                profiles: migrationResult.migratedProfiles,
                submissions: migrationResult.migratedSubmissions,
              },
            })
          }
        }
      } catch (migrationErr) {
        // Don't fail unlock if migration fails - log error and continue
        console.error('Migration failed:', migrationErr)
        // Migration can be retried later
      }

      return success
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unlock vault'
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Lock vault
  const lock = useCallback(async () => {
    try {
      setError(null)
      await lockVault()
      setIsUnlocked(false)

      // Log vault lock event
      if (user?.id) {
        logPredefinedEvent('VAULT_LOCK', {
          action: 'lock',
          resourceType: 'vault',
          resourceId: user.id,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to lock vault'
      setError(message)
      throw err
    }
  }, [user?.id])

  // Change master password
  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!user?.id) {
      throw new Error('User not authenticated')
    }

    try {
      setLoading(true)
      setError(null)
      await changeMasterPassword(oldPassword, newPassword, user.id)

      // Log password change event
      logPredefinedEvent('VAULT_PASSWORD_CHANGED', {
        action: 'change_password',
        resourceType: 'vault',
        resourceId: user.id,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Encrypt a single field
  const encrypt = useCallback(async (plaintext: string): Promise<{ ciphertext: string; iv: string }> => {
    try {
      return await encryptField(plaintext)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Encryption failed'
      setError(message)
      throw err
    }
  }, [])

  // Decrypt a single field
  const decrypt = useCallback(async (ciphertext: string, iv: string): Promise<string> => {
    try {
      return await decryptField(ciphertext, iv)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Decryption failed'
      setError(message)
      throw err
    }
  }, [])

  // Encrypt multiple fields
  const encryptMultiple = useCallback(async (
    fields: Record<string, string>
  ): Promise<Record<string, { ciphertext: string; iv: string }>> => {
    try {
      return await encryptFields(fields)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Encryption failed'
      setError(message)
      throw err
    }
  }, [])

  // Decrypt multiple fields
  const decryptMultiple = useCallback(async (
    fields: Record<string, { ciphertext: string; iv: string }>
  ): Promise<Record<string, string>> => {
    try {
      return await decryptFields(fields)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Decryption failed'
      setError(message)
      throw err
    }
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Refresh vault status
  const refresh = useCallback(async () => {
    if (!user?.id) {
      return
    }

    try {
      const vaultExists = await hasVault(user.id)
      setIsSetup(vaultExists)

      if (vaultExists) {
        const unlocked = await isVaultUnlocked(user.id)
        setIsUnlocked(unlocked)
      }
    } catch (err) {
      console.error('Error refreshing vault status:', err)
    }
  }, [user?.id])

  const value: VaultContextType = {
    isUnlocked,
    isSetup,
    loading,
    error,
    setup,
    unlock,
    lock,
    changePassword,
    encrypt,
    decrypt,
    encryptMultiple,
    decryptMultiple,
    clearError,
    refresh,
  }

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  )
}

export function useVault() {
  const context = useContext(VaultContext)
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider')
  }
  return context
}
