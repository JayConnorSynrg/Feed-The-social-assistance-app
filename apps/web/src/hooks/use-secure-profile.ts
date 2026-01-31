'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  SecureProfileData,
  encryptProfile,
  decryptProfile,
  createUserKey,
  importAndCacheKey,
  createKeyCheck,
  verifyKey,
  hasKey,
  clearUserKey,
  getCachedKey,
} from '@/lib/secure-profile'

interface UseSecureProfileState {
  data: SecureProfileData | null
  loading: boolean
  error: string | null
  hasEncryptionKey: boolean
  isUnlocked: boolean
}

interface UseSecureProfileReturn extends UseSecureProfileState {
  unlock: (exportedKey: string) => Promise<boolean>
  lock: () => void
  save: (data: SecureProfileData) => Promise<boolean>
  setupEncryption: () => Promise<{ exportedKey: string } | null>
  refresh: () => Promise<void>
}

/**
 * Hook for managing encrypted profile data
 *
 * Usage:
 * 1. Call setupEncryption() for first-time users to create encryption key
 * 2. Store the returned exportedKey securely (e.g., show to user to save)
 * 3. Call unlock(exportedKey) to decrypt and access data
 * 4. Call save(data) to update encrypted profile
 * 5. Call lock() to clear decrypted data from memory
 */
export function useSecureProfile(): UseSecureProfileReturn {
  const [state, setState] = useState<UseSecureProfileState>({
    data: null,
    loading: true,
    error: null,
    hasEncryptionKey: false,
    isUnlocked: hasKey(),
  })

  const supabase = createClient()

  // Check if user has encrypted profile
  const checkProfile = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Not authenticated',
        }))
        return
      }

      // Check for existing encrypted profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile, error } = await (supabase as any)
        .from('secure_profiles')
        .select('encrypted_data, key_check, version')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (expected for new users)
        throw error
      }

      const hasProfile = !!profile?.encrypted_data

      // If we have a cached key, try to decrypt
      if (hasProfile && hasKey()) {
        try {
          const key = getCachedKey()!
          const isValid = await verifyKey(key, profile.key_check)

          if (isValid) {
            const decrypted = await decryptProfile(profile.encrypted_data, key)
            setState({
              data: decrypted,
              loading: false,
              error: null,
              hasEncryptionKey: true,
              isUnlocked: true,
            })
            return
          }
        } catch {
          // Key invalid, clear it
          clearUserKey()
        }
      }

      setState({
        data: null,
        loading: false,
        error: null,
        hasEncryptionKey: hasProfile,
        isUnlocked: false,
      })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load profile',
      }))
    }
  }, [supabase])

  // Initial load
  useEffect(() => {
    checkProfile()
  }, [checkProfile])

  /**
   * Set up encryption for first-time user
   * Returns the exported key that user should save securely
   */
  const setupEncryption = useCallback(async (): Promise<{ exportedKey: string } | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      // Generate new encryption key
      const { key, exportedKey } = await createUserKey()
      const keyCheck = await createKeyCheck(key)

      // Create empty encrypted profile
      const emptyProfile: SecureProfileData = {}
      const encryptedData = await encryptProfile(emptyProfile, key)

      // Save to database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('secure_profiles')
        .upsert({
          user_id: user.id,
          encrypted_data: encryptedData,
          key_check: keyCheck,
          version: 1,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error

      // Cache the key
      await importAndCacheKey(exportedKey, user.id)

      setState({
        data: emptyProfile,
        loading: false,
        error: null,
        hasEncryptionKey: true,
        isUnlocked: true,
      })

      return { exportedKey }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to setup encryption',
      }))
      return null
    }
  }, [supabase])

  /**
   * Unlock profile with encryption key
   */
  const unlock = useCallback(
    async (exportedKey: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('Not authenticated')
        }

        // Import the key
        const key = await importAndCacheKey(exportedKey, user.id)

        // Get encrypted profile
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile, error } = await (supabase as any)
          .from('secure_profiles')
          .select('encrypted_data, key_check')
          .eq('user_id', user.id)
          .single()

        if (error) throw error

        // Verify key
        const isValid = await verifyKey(key, profile.key_check)
        if (!isValid) {
          clearUserKey()
          throw new Error('Invalid encryption key')
        }

        // Decrypt data
        const decrypted = await decryptProfile(profile.encrypted_data, key)

        setState({
          data: decrypted,
          loading: false,
          error: null,
          hasEncryptionKey: true,
          isUnlocked: true,
        })

        return true
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to unlock',
          isUnlocked: false,
        }))
        return false
      }
    },
    [supabase]
  )

  /**
   * Lock profile (clear decrypted data from memory)
   */
  const lock = useCallback(() => {
    clearUserKey()
    setState((prev) => ({
      ...prev,
      data: null,
      isUnlocked: false,
    }))
  }, [])

  /**
   * Save profile data
   */
  const save = useCallback(
    async (data: SecureProfileData): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('Not authenticated')
        }

        if (!hasKey()) {
          throw new Error('Profile is locked')
        }

        const key = getCachedKey()!
        const encryptedData = await encryptProfile(data, key)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('secure_profiles')
          .update({
            encrypted_data: encryptedData,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)

        if (error) throw error

        setState((prev) => ({
          ...prev,
          data,
          loading: false,
          error: null,
        }))

        return true
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to save',
        }))
        return false
      }
    },
    [supabase]
  )

  /**
   * Refresh profile data
   */
  const refresh = useCallback(async () => {
    await checkProfile()
  }, [checkProfile])

  return {
    ...state,
    unlock,
    lock,
    save,
    setupEncryption,
    refresh,
  }
}
