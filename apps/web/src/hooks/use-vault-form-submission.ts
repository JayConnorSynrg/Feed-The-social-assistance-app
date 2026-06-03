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

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVault } from '@/contexts/vault-context'
import { withMetric } from '@/lib/logger'
import {
  encryptFormSubmission,
  decryptFormSubmission,
  type EncryptedFormSubmission,
} from '@/lib/field-encryption'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'

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
  submitForm: (formData: Record<string, unknown>, signatureData?: string, fallbackTemplateId?: string) => Promise<boolean>
  loadSubmission: (submissionId: string) => Promise<boolean>
  updateStatus: (status: SubmissionStatus, notes?: string) => Promise<boolean>
}

// ============================================
// User Submissions List Hook (vault-decrypted)
// ============================================

interface UseUserSubmissionsReturn {
  submissions: FormSubmission[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Lists the current user's form submissions and decrypts each via the vault path.
 * Returns typed-empty (empty array) when the vault is locked — callers must guard
 * with VaultGuard so users see the unlock prompt rather than an empty list.
 */
export function useUserSubmissions(
  options: {
    templateId?: string
    status?: SubmissionStatus
  } = {}
): UseUserSubmissionsReturn {
  const { isUnlocked } = useVault()
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchSubmissions = useCallback(async () => {
    // Guard: vault locked → return typed-empty, no throw
    if (!isUnlocked) {
      setSubmissions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setSubmissions([])
        setLoading(false)
        return
      }

      let query = supabase
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
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (options.templateId) {
        query = query.eq('template_id', options.templateId)
      }

      if (options.status) {
        query = query.eq('status', options.status)
      }

      const { data, error: fetchError } = await query.abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (fetchError) throw fetchError

      // Decrypt each submission — fall back to empty formData on decrypt failure
      const decrypted: FormSubmission[] = await Promise.all(
        (data || []).map(async (row) => {
          let formData: Record<string, unknown> = {}
          let signatureData: string | undefined

          if (row.encrypted_form_data && row.form_data_iv) {
            try {
              const result = await decryptFormSubmission({
                encrypted_form_data: row.encrypted_form_data,
                form_data_iv: row.form_data_iv,
                encrypted_signature_data: row.encrypted_signature_data || undefined,
                signature_data_iv: row.signature_data_iv || undefined,
              })
              formData = result.formData
              signatureData = result.signatureData
            } catch {
              // Decryption failure for a single row must not block the whole list
            }
          }

          const submission: FormSubmission = {
            id: row.id,
            templateId: row.template_id,
            userId: row.user_id,
            status: row.status as SubmissionStatus,
            formData,
            signatureData,
            submittedAt: row.submitted_at || undefined,
            processedAt: undefined,
            notes: row.notes || undefined,
            createdAt: row.created_at || '',
            updatedAt: row.updated_at || '',
          }
          return submission
        })
      )

      setSubmissions(decrypted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }, [supabase, isUnlocked, options.templateId, options.status])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  return {
    submissions,
    loading,
    error,
    refresh: fetchSubmissions,
  }
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

        const { data, error } = await withMetric(
          'forms.draft',
          { template_id: templateId },
          async () => await supabase
            .from('form_submissions')
            .insert(submission)
            .select('*')
            .single()
        )

        if (error) throw error

        const newSubmission: FormSubmission = {
          id: data.id,
          templateId: data.template_id,
          userId: data.user_id,
          status: data.status as SubmissionStatus,
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
   *
   * If createDraft raced against the vault unlock and never resolved, state.submission
   * may be null at submit time. In that case we INSERT a new row directly at submitted
   * status rather than failing — the templateId is always available from the hook caller.
   * The templateId must be passed via the optional third parameter in that fallback path.
   */
  const submitForm = useCallback(
    async (formData: Record<string, unknown>, signatureData?: string, fallbackTemplateId?: string): Promise<boolean> => {
      if (!isUnlocked) {
        setState((prev) => ({ ...prev, error: 'Vault is locked. Please unlock first.' }))
        return false
      }

      setState((prev) => ({ ...prev, saving: true, error: null }))

      try {
        // Encrypt form data and signature
        const encryptedData = await encryptFormSubmission(formData, signatureData)

        const now = new Date().toISOString()

        if (state.submission) {
          // Happy path: draft exists — UPDATE it to submitted.
          // RLS: UPDATE allowed when current status is draft or in_progress.
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

          const { error: updateError } = await withMetric(
            'forms.submit',
            { template_id: state.submission.templateId, has_signature: signatureData != null },
            async () => await supabase
              .from('form_submissions')
              .update(updates)
              .eq('id', state.submission!.id)
          )

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
        } else {
          // Fallback path: no draft row in state (createDraft raced and lost).
          // INSERT directly at submitted status. Requires templateId from caller.
          const templateId = fallbackTemplateId
          if (!templateId) {
            throw new Error('No draft loaded and no templateId provided for direct submit')
          }

          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (!user) {
            throw new Error('Not authenticated')
          }

          const submission = {
            template_id: templateId,
            user_id: user.id,
            status: 'submitted' as SubmissionStatus,
            form_data: null,
            ...encryptedData,
            encryption_migrated: true,
            submitted_at: now,
          }

          const { data, error: insertError } = await withMetric(
            'forms.submit_direct',
            { template_id: templateId, has_signature: signatureData != null },
            async () => await supabase
              .from('form_submissions')
              .insert(submission)
              .select('id, template_id, user_id, status, created_at, updated_at, submitted_at')
              .single()
          )

          if (insertError) throw insertError

          setState((prev) => ({
            ...prev,
            submission: {
              id: data.id,
              templateId: data.template_id,
              userId: data.user_id,
              status: 'submitted' as SubmissionStatus,
              formData,
              signatureData,
              submittedAt: data.submitted_at || now,
              processedAt: undefined,
              notes: undefined,
              createdAt: data.created_at || now,
              updatedAt: data.updated_at || now,
            },
            saving: false,
            error: null,
          }))
        }

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
          status: data.status as SubmissionStatus,
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
        const updates: {
          status: SubmissionStatus
          updated_at: string
          notes?: string | null
        } = {
          status,
          updated_at: new Date().toISOString(),
        }

        if (notes !== undefined) {
          updates.notes = notes
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
