'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FormTemplateSchema } from '@/lib/form-schemas'
import { extractSensitiveFields } from '@/lib/form-field-mapper'
import { encryptProfile, hasKey, getCachedKey } from '@/lib/secure-profile'

// ============================================
// Types
// ============================================

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'archived'

export interface FormSubmission {
  id: string
  templateId: string
  userId: string
  status: SubmissionStatus
  data: Record<string, unknown>
  encryptedData?: string
  submittedAt?: string
  processedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

interface UseFormSubmissionState {
  submission: FormSubmission | null
  loading: boolean
  saving: boolean
  error: string | null
}

interface UseFormSubmissionReturn extends UseFormSubmissionState {
  createDraft: (templateId: string) => Promise<string | null>
  saveDraft: (data: Record<string, unknown>) => Promise<boolean>
  submitForm: (data: Record<string, unknown>, signatureData?: string) => Promise<boolean>
  loadSubmission: (submissionId: string) => Promise<boolean>
  updateStatus: (status: SubmissionStatus, notes?: string) => Promise<boolean>
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook for managing form submissions
 */
export function useFormSubmission(
  template?: FormTemplateSchema
): UseFormSubmissionReturn {
  const [state, setState] = useState<UseFormSubmissionState>({
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

        const submission = {
          template_id: templateId,
          user_id: user.id,
          status: 'draft' as SubmissionStatus,
          data: {},
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('form_submissions')
          .insert(submission)
          .select('*')
          .single()

        if (error) throw error

        const newSubmission: FormSubmission = {
          id: data.id,
          templateId: data.template_id,
          userId: data.user_id,
          status: data.status,
          data: data.data || {},
          encryptedData: data.encrypted_data,
          submittedAt: data.submitted_at,
          processedAt: data.processed_at,
          notes: data.notes,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
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
    async (data: Record<string, unknown>): Promise<boolean> => {
      if (!state.submission) {
        setState((prev) => ({ ...prev, error: 'No submission loaded' }))
        return false
      }

      setState((prev) => ({ ...prev, saving: true, error: null }))

      try {
        // Separate sensitive and non-sensitive data
        let encryptedData: string | undefined
        const publicData = { ...data }

        if (template && hasKey()) {
          const sensitiveData = extractSensitiveFields(template, data)
          const key = getCachedKey()!

          // Remove sensitive fields from public data
          for (const field of template.fields) {
            if (field.sensitive) {
              delete publicData[field.name]
            }
          }

          // Encrypt sensitive data
          if (Object.keys(sensitiveData).length > 0) {
            encryptedData = await encryptProfile(sensitiveData, key)
          }
        }

        const updates: Record<string, unknown> = {
          data: publicData,
          updated_at: new Date().toISOString(),
        }

        if (encryptedData) {
          updates.encrypted_data = encryptedData
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('form_submissions')
          .update(updates)
          .eq('id', state.submission.id)

        if (error) throw error

        setState((prev) => ({
          ...prev,
          submission: prev.submission
            ? {
                ...prev.submission,
                data: publicData,
                encryptedData,
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
    [supabase, state.submission, template]
  )

  /**
   * Submit the form (changes status from draft to submitted)
   */
  const submitForm = useCallback(
    async (
      data: Record<string, unknown>,
      signatureData?: string
    ): Promise<boolean> => {
      if (!state.submission) {
        setState((prev) => ({ ...prev, error: 'No submission loaded' }))
        return false
      }

      setState((prev) => ({ ...prev, saving: true, error: null }))

      try {
        // First save the data
        let encryptedData: string | undefined
        const publicData = { ...data }

        if (template && hasKey()) {
          const sensitiveData = extractSensitiveFields(template, data)
          const key = getCachedKey()!

          // Remove sensitive fields from public data
          for (const field of template.fields) {
            if (field.sensitive) {
              delete publicData[field.name]
            }
          }

          // Encrypt sensitive data
          if (Object.keys(sensitiveData).length > 0) {
            encryptedData = await encryptProfile(sensitiveData, key)
          }
        }

        const now = new Date().toISOString()
        const updates: Record<string, unknown> = {
          data: publicData,
          status: 'submitted',
          submitted_at: now,
          updated_at: now,
        }

        if (encryptedData) {
          updates.encrypted_data = encryptedData
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('form_submissions')
          .update(updates)
          .eq('id', state.submission.id)

        if (updateError) throw updateError

        // Save signature if provided
        if (signatureData) {
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (user) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('form_signatures').upsert(
              {
                submission_id: state.submission.id,
                user_id: user.id,
                signature_data: signatureData,
                user_agent:
                  typeof navigator !== 'undefined' ? navigator.userAgent : null,
                signed_at: now,
              },
              { onConflict: 'submission_id,user_id' }
            )
          }
        }

        setState((prev) => ({
          ...prev,
          submission: prev.submission
            ? {
                ...prev.submission,
                data: publicData,
                encryptedData,
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
    [supabase, state.submission, template]
  )

  /**
   * Load an existing submission
   */
  const loadSubmission = useCallback(
    async (submissionId: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('form_submissions')
          .select('*')
          .eq('id', submissionId)
          .single()

        if (error) throw error

        const submission: FormSubmission = {
          id: data.id,
          templateId: data.template_id,
          userId: data.user_id,
          status: data.status,
          data: data.data || {},
          encryptedData: data.encrypted_data,
          submittedAt: data.submitted_at,
          processedAt: data.processed_at,
          notes: data.notes,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
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
    [supabase]
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

        if (status === 'approved' || status === 'rejected') {
          updates.processed_at = new Date().toISOString()
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
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
                  status === 'approved' || status === 'rejected'
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

// ============================================
// User Submissions List Hook
// ============================================

interface UseUserSubmissionsReturn {
  submissions: FormSubmission[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Hook for listing user's form submissions
 */
export function useUserSubmissions(
  options: {
    templateId?: string
    status?: SubmissionStatus
  } = {}
): UseUserSubmissionsReturn {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('form_submissions')
        .select('*')
        .order('created_at', { ascending: false })

      if (options.templateId) {
        query = query.eq('template_id', options.templateId)
      }

      if (options.status) {
        query = query.eq('status', options.status)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      const formattedSubmissions: FormSubmission[] = (data || []).map(
        (row: Record<string, unknown>) => ({
          id: row.id as string,
          templateId: row.template_id as string,
          userId: row.user_id as string,
          status: row.status as SubmissionStatus,
          data: (row.data || {}) as Record<string, unknown>,
          encryptedData: row.encrypted_data as string | undefined,
          submittedAt: row.submitted_at as string | undefined,
          processedAt: row.processed_at as string | undefined,
          notes: row.notes as string | undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        })
      )

      setSubmissions(formattedSubmissions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }, [supabase, options.templateId, options.status])

  // Fetch on mount and when options change
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
