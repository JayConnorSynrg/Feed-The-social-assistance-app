/**
 * Vault-based Form Submission Hook
 *
 * Manages form submissions using the vault encryption system.
 * Replaces the old useFormSubmission hook with vault-based encryption.
 *
 * Uses:
 * - Vault DEK for encryption/decryption
 * - New encrypted fields in form_submissions table
 * - Automatic migration from plaintext to encrypted
 */

'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVault } from '@/contexts/vault-context'
import {
  encryptFormSubmission,
  decryptFormSubmission,
  type EncryptedFormSubmission,
} from '@/lib/field-encryption'

// ============================================
// Types
// ============================================

// Must match database enum: submission_status
export type SubmissionStatus =
  | 'draft'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'denied'
  | 'pending_info'
  | 'expired'

export interface FormSubmission {
  id: string
  templateId: string
  userId: string
  status: SubmissionStatus
  formData: Record<string, unknown>
  signatureData?: string
  submittedAt?: string
  processedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

interface UseVaultFormSubmissionState {
  submission: FormSubmission | null
  loading: boolean
  saving: boolean
  error: string | null
}

interface UseVaultFormSubmissionReturn extends UseVaultFormSubmissionState {
  createDraft: (templateId: string) => Promise<string | null>
  saveDraft: (formData: Record<string, unknown>) => Promise<boolean>
  submitForm: (formData: Record<string, unknown>, signatureData?: string) => Promise<boolean>
  loadSubmission: (submissionId: string) => Promise<boolean>
  updateStatus: (status: SubmissionStatus, notes?: string) => Promise<boolean>
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook for managing form submissions with vault encryption
 */
export function useVaultFormSubmission(): UseVaultFormSubmissionReturn {
  const { isUnlocked } = useVault()
  const [state, setState] = useState<UseVaultFormSubmissionState>({
    submission: null,
    loading: false,
    saving: false,
    error: null,
  })

  const supabase = createClient()

  /**
   * Create a new draft submission
   */
  const createDraft = useCallback(
    async (templateId: string): Promise<string | null> => {
      setState((prev) => ({ ...prev, saving: true, error: null }))

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          throw new Error('Not authenticated')
        }

        // Encrypt empty form data
        const encryptedData = await encryptFormSubmission({})

        const submission = {
          template_id: templateId,
          user_id: user.id,
          status: 'draft' as SubmissionStatus,
          // SECURITY: form_data must NOT be written with plaintext. All form data
          // is encrypted via encryptFormSubmission() and stored in encrypted_form_data
          // + form_data_iv. Writing plaintext here would negate zero-knowledge
          // encryption and destroy the statutory safe harbor under all 50-state
          // breach notification laws. Set to null to signal "use encrypted columns".
          form_data: null,
          ...encryptedData,
          encryption_migrated: true,
        }

        const { data, error } = await supabase
          .from('form_submissions')
          .insert(submission)
          .select('*')
          .single()

        if (error) throw error

        const newSubmission: FormSubmission = {
          id: data.id,
          templateId: data.template_id,
          userId: data.user_id,
          status: data.status as any,
          formData: {},
          signatureData: undefined,
          submittedAt: data.submitted_at || undefined,
          processedAt: undefined, // Field doesn't exist in DB yet
          notes: data.notes || undefined,
          createdAt: data.created_at || '',
          updatedAt: data.updated_at || '',
        }

        setState({
          submission: newSubmission,
          loading: false,
          saving: false,
          error: null,
        })

        return data.id
      } catch (error) {
        setState((prev) => ({
          ...prev,
          saving: false,
          error: error instanceof Error ? error.message : 'Failed to create draft',
        }))
        return null
      }
    },
    [supabase]
  )

  /**
   * Save form data as draft
   */
  const saveDraft = useCallback(
    async (formData: Record<string, unknown>): Promise<boolean> => {
      if (!state.submission) {
        setState((prev) => ({ ...prev, error: 'No submission loaded' }))
        return false
      }

      if (!isUnlocked) {
        setState((prev) => ({ ...prev, error: 'Vault is locked. Please unlock first.' }))
        return false
      }

      setState((prev) => ({ ...prev, saving: true, error: null }))

      try {
        // Encrypt form data
        const encryptedData = await encryptFormSubmission(formData)

        const updates = {
          // SECURITY: Plaintext form_data must not be written. Sensitive PII
          // (SSN, income, medical, immigration status) must only exist in the
          // encrypted_form_data column. Setting to null preserves the database
          // column without exposing cleartext data; use migrate-to-encrypted.ts
          // to backfill any pre-existing plaintext rows.
          form_data: null,
          ...encryptedData,
          encryption_migrated: true,
          updated_at: new Date().toISOString(),
        }

        const { error } = await supabase
          .from('form_submissions')
          .update(updates)
          .eq('id', state.submission.id)

        if (error) throw error

        setState((prev) => ({
          ...prev,
          submission: prev.submission
            ? {
                ...prev.submission,
                formData,
                updatedAt: new Date().toISOString(),
              }
            : null,
          saving: false,
          error: null,
        }))

        return true
      } catch (error) {
        setState((prev) => ({
          ...prev,
          saving: false,
          error: error instanceof Error ? error.message : 'Failed to save draft',
        }))
        return false
      }
    },
    [supabase, state.submission, isUnlocked]
  )

  /**
   * Submit the form (changes status from draft to submitted)
   */
  const submitForm = useCallback(
    async (formData: Record<string, unknown>, signatureData?: string): Promise<boolean> => {
      if (!state.submission) {
        setState((prev) => ({ ...prev, error: 'No submission loaded' }))
        return false
      }

      if (!isUnlocked) {
        setState((prev) => ({ ...prev, error: 'Vault is locked. Please unlock first.' }))
        return false
      }

      setState((prev) => ({ ...prev, saving: true, error: null }))

      try {
        // Encrypt form data and signature
        const encryptedData = await encryptFormSubmission(formData, signatureData)

        const now = new Date().toISOString()
        const updates = {
          // SECURITY: Plaintext form_data is explicitly null on submission.
          // Submitted forms contain the most sensitive data (completed SSN,
          // full income figures, immigration status). All data must be retrieved
          // exclusively through decryptFormSubmission() using the user's vault DEK.
          // Writing plaintext at submission constitutes an FTC Section 5 deception
          // violation given the zero-knowledge encryption representations made to users.
          form_data: null,
          ...encryptedData,
          encryption_migrated: true,
          status: 'submitted' as const,
          submitted_at: now,
          updated_at: now,
        }

        const { error: updateError } = await supabase
          .from('form_submissions')
          .update(updates)
          .eq('id', state.submission.id)

        if (updateError) throw updateError

        setState((prev) => ({
          ...prev,
          submission: prev.submission
            ? {
                ...prev.submission,
                formData,
                signatureData,
                status: 'submitted',
                submittedAt: now,
                updatedAt: now,
              }
            : null,
          saving: false,
          error: null,
        }))

        return true
      } catch (error) {
        setState((prev) => ({
          ...prev,
          saving: false,
          error: error instanceof Error ? error.message : 'Failed to submit form',
        }))
        return false
      }
    },
    [supabase, state.submission, isUnlocked]
  )

  /**
   * Load an existing submission
   */
  const loadSubmission = useCallback(
    async (submissionId: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const { data, error } = await supabase
          .from('form_submissions')
          .select(
            `
            id,
            template_id,
            user_id,
            status,
            encrypted_form_data,
            form_data_iv,
            encrypted_signature_data,
            signature_data_iv,
            submitted_at,
            notes,
            created_at,
            updated_at
          `
          )
          .eq('id', submissionId)
          .single()

        if (error) throw error

        // Decrypt form data if vault is unlocked
        let formData: Record<string, unknown> = {}
        let signatureData: string | undefined

        if (
          isUnlocked &&
          data.encrypted_form_data &&
          data.form_data_iv
        ) {
          try {
            const decrypted = await decryptFormSubmission({
              encrypted_form_data: data.encrypted_form_data,
              form_data_iv: data.form_data_iv,
              encrypted_signature_data: data.encrypted_signature_data || undefined,
              signature_data_iv: data.signature_data_iv || undefined,
            })
            formData = decrypted.formData
            signatureData = decrypted.signatureData
          } catch (decryptError) {
            console.error('Failed to decrypt submission:', decryptError)
            // Fall back to empty data if decryption fails
          }
        }

        const submission: FormSubmission = {
          id: data.id,
          templateId: data.template_id,
          userId: data.user_id,
          status: data.status as any,
          formData,
          signatureData,
          submittedAt: data.submitted_at || undefined,
          processedAt: undefined, // Field doesn't exist in DB yet
          notes: data.notes || undefined,
          createdAt: data.created_at || '',
          updatedAt: data.updated_at || '',
        }

        setState({
          submission,
          loading: false,
          saving: false,
          error: null,
        })

        return true
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load submission',
        }))
        return false
      }
    },
    [supabase, isUnlocked]
  )

  /**
   * Update submission status (for admins)
   */
  const updateStatus = useCallback(
    async (status: SubmissionStatus, notes?: string): Promise<boolean> => {
      if (!state.submission) {
        setState((prev) => ({ ...prev, error: 'No submission loaded' }))
        return false
      }

      setState((prev) => ({ ...prev, saving: true, error: null }))

      try {
        const updates: Record<string, unknown> = {
          status,
          updated_at: new Date().toISOString(),
        }

        if (notes !== undefined) {
          updates.notes = notes
        }

        // TODO: Add processed_at field to form_submissions table if needed
        // if (status === 'approved' || status === 'rejected') {
        //   updates.processed_at = new Date().toISOString()
        // }

        const { error } = await supabase
          .from('form_submissions')
          .update(updates)
          .eq('id', state.submission.id)

        if (error) throw error

        setState((prev) => ({
          ...prev,
          submission: prev.submission
            ? {
                ...prev.submission,
                status,
                notes: notes ?? prev.submission.notes,
                processedAt:
                  status === 'approved' || status === 'denied'
                    ? new Date().toISOString()
                    : prev.submission.processedAt,
                updatedAt: new Date().toISOString(),
              }
            : null,
          saving: false,
          error: null,
        }))

        return true
      } catch (error) {
        setState((prev) => ({
          ...prev,
          saving: false,
          error: error instanceof Error ? error.message : 'Failed to update status',
        }))
        return false
      }
    },
    [supabase, state.submission]
  )

  return {
    ...state,
    createDraft,
    saveDraft,
    submitForm,
    loadSubmission,
    updateStatus,
  }
}
