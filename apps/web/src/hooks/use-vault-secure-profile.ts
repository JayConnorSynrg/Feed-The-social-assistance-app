/**
 * Vault-based Secure Profile Hook
 *
 * Manages secure profile data using the vault encryption system.
 * Replaces the old useSecureProfile hook with vault-based encryption.
 *
 * Uses:
 * - Vault DEK for encryption/decryption
 * - New encrypted fields in user_secure_profiles table
 * - Automatic migration from plaintext to encrypted
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVault } from '@/contexts/vault-context'
import {
  encryptSecureProfile,
  decryptSecureProfile,
  type SecureProfileInput,
  type EncryptedSecureProfile,
} from '@/lib/field-encryption'
import { logPredefinedEvent } from '@/lib/audit-logger'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'

export interface UseVaultSecureProfileReturn {
  // Data
  profile: SecureProfileInput | null
  loading: boolean
  error: string | null

  // Actions
  save: (profile: SecureProfileInput) => Promise<boolean>
  refresh: () => Promise<void>
  clearError: () => void
}

/**
 * Hook for managing secure profile data with vault encryption
 *
 * Requires vault to be unlocked before use.
 */
export function useVaultSecureProfile(): UseVaultSecureProfileReturn {
  const { isUnlocked } = useVault()
  const [profile, setProfile] = useState<SecureProfileInput | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Fetch and decrypt profile data
  const fetchProfile = useCallback(async () => {
    if (!isUnlocked) {
      setProfile(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      // Fetch encrypted profile data
      const { data, error: fetchError } = await supabase
        .from('user_secure_profiles')
        .select(
          `
          encrypted_household_members,
          household_members_iv,
          encrypted_employer_info,
          employer_info_iv,
          encrypted_emergency_contact,
          emergency_contact_iv,
          encrypted_mailing_address,
          mailing_address_iv,
          encrypted_residential_address,
          residential_address_iv,
          encrypted_current_benefits,
          current_benefits_iv,
          encryption_migrated
        `
        )
        .eq('id', user.id)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        .single()

      if (fetchError) {
        // If no profile exists yet, that's okay - return empty profile
        if (fetchError.code === 'PGRST116') {
          setProfile({})
          setLoading(false)
          return
        }
        throw fetchError
      }

      if (!data) {
        setProfile({})
        setLoading(false)
        return
      }

      // Decrypt profile data
      try {
        const decrypted = await decryptSecureProfile(data as EncryptedSecureProfile)
        setProfile(decrypted)

        // Log profile access
        logPredefinedEvent('PROFILE_SENSITIVE_VIEWED', {
          action: 'read',
          resourceType: 'secure_profile',
          resourceId: user.id,
        })
      } catch (decryptError) {
        console.error('Failed to decrypt profile:', decryptError)
        logPredefinedEvent('ENCRYPTION_ERROR', {
          action: 'decrypt',
          resourceType: 'secure_profile',
          resourceId: user.id,
        })
        setError('Failed to decrypt profile data')
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
      if (!isQueryTimeout(err)) {
        logPredefinedEvent('VAULT_UNLOCK_FAILED', {
          action: 'read',
          resourceType: 'secure_profile',
        })
      }
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [isUnlocked, supabase])

  // Load profile when vault is unlocked
  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Save profile data
  const save = useCallback(
    async (profileData: SecureProfileInput): Promise<boolean> => {
      if (!isUnlocked) {
        setError('Vault is locked. Please unlock first.')
        return false
      }

      setLoading(true)
      setError(null)

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          throw new Error('Not authenticated')
        }

        // Encrypt profile data
        const encrypted = await encryptSecureProfile(profileData)

        // Save to database
        const { error: saveError } = await supabase.from('user_secure_profiles').upsert({
          id: user.id,
          ...encrypted,
          encryption_migrated: true,
          encryption_migrated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        if (saveError) {
          throw saveError
        }

        // Update local state
        setProfile(profileData)

        // Log profile update
        logPredefinedEvent('PROFILE_SENSITIVE_UPDATED', {
          action: 'update',
          resourceType: 'secure_profile',
          resourceId: user.id,
          details: {
            fields_updated: Object.keys(profileData).filter((k) => profileData[k as keyof SecureProfileInput]),
          },
        })

        setLoading(false)
        return true
      } catch (err) {
        console.error('Failed to save profile:', err)
        logPredefinedEvent('ENCRYPTION_ERROR', {
          action: 'encrypt',
          resourceType: 'secure_profile',
        })
        setError(err instanceof Error ? err.message : 'Failed to save profile')
        setLoading(false)
        return false
      }
    },
    [isUnlocked, supabase]
  )

  // Refresh profile data
  const refresh = useCallback(async () => {
    await fetchProfile()
  }, [fetchProfile])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    profile,
    loading,
    error,
    save,
    refresh,
    clearError,
  }
}
