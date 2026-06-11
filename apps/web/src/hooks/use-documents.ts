// apps/web/src/hooks/use-documents.ts
// Hook for managing user documents with Supabase Storage

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'

export type DocumentCategory =
  | 'identity'
  | 'income'
  | 'residence'
  | 'medical'
  | 'forms'
  | 'other'

export interface Document {
  id: string
  user_id: string
  name: string
  file_path: string
  /** Maps to user_documents.document_type */
  document_type: string
  file_size: number | null
  category: string | null
  /** Maps to user_documents.submission_id */
  submission_id?: string | null
  notes?: string | null
  created_at: string | null
  url?: string
}

export interface UpdateDocumentInput {
  name?: string
  category?: string
}

export interface UseDocumentsReturn {
  documents: Document[]
  isLoading: boolean
  error: Error | null
  updateDocument: (id: string, updates: UpdateDocumentInput) => Promise<boolean>
  deleteDocument: (id: string) => Promise<void>
  getDocumentUrl: (filePath: string) => Promise<string | null>
  refreshDocuments: () => Promise<void>
  getDocumentsByCategory: (category: string) => Document[]
  getDocumentsByApplication: (submissionId: string) => Document[]
}

const CATEGORY_INFO: Record<DocumentCategory, { label: string; icon: string; description: string }> = {
  identity: {
    label: 'Identity Documents',
    icon: '🪪',
    description: "Driver's license, passport, birth certificate, etc.",
  },
  income: {
    label: 'Income Documents',
    icon: '💵',
    description: 'Pay stubs, tax returns, benefit letters, etc.',
  },
  residence: {
    label: 'Residence Documents',
    icon: '🏠',
    description: 'Lease, utility bills, mortgage statement, etc.',
  },
  medical: {
    label: 'Medical Documents',
    icon: '🏥',
    description: 'Insurance cards, medical records, prescriptions, etc.',
  },
  forms: {
    label: 'Submitted Forms',
    icon: '📋',
    description: 'Completed benefit applications and forms',
  },
  other: {
    label: 'Other Documents',
    icon: '📄',
    description: 'Any other supporting documents',
  },
}

export function getCategoryInfo(category: string) {
  return CATEGORY_INFO[category as DocumentCategory] || CATEGORY_INFO.other
}

const STORAGE_BUCKET = 'documents'

export function useDocuments(): UseDocumentsReturn {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const supabase = createClient()

  const refreshDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error: fetchError } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (fetchError) throw fetchError

      setDocuments(data || [])
    } catch (err) {
      logger.error('documents.refresh.error', err)
      setError(
        isQueryTimeout(err)
          ? new Error('Documents timed out. Please try again.')
          : err as Error
      )
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  /**
   * Update a document's plaintext `name` and/or `category`.
   *
   * This hook does NOT hold the vault DEK, so it can only write the plaintext
   * `name` column. For ENCRYPTED documents the plaintext `name` is the non-PII
   * placeholder and the real filename lives in encrypted_original_name — those
   * are renamed via useEncryptedUpload.renameEncrypted (which has vault access).
   * The Documents panel routes encrypted renames there and only uses this path
   * for category moves and legacy unencrypted-document renames.
   */
  const updateDocument = useCallback(async (id: string, updates: UpdateDocumentInput): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const payload: { name?: string; category?: string } = {}
      if (updates.name !== undefined) payload.name = updates.name
      if (updates.category !== undefined) payload.category = updates.category

      if (Object.keys(payload).length === 0) return true

      const { error: updateError } = await supabase
        .from('user_documents')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (updateError) throw updateError

      // Optimistic local state update
      setDocuments(prev => prev.map(d =>
        d.id === id
          ? { ...d, ...(updates.name ? { name: updates.name } : {}), ...(updates.category ? { category: updates.category } : {}) }
          : d
      ))

      return true
    } catch (err) {
      logger.error('documents.update.error', err, { id })
      setError(
        isQueryTimeout(err)
          ? new Error('Update timed out. Please try again.')
          : err as Error
      )
      return false
    }
  }, [supabase])

  const deleteDocument = useCallback(async (id: string) => {
    try {
      const doc = documents.find(d => d.id === id)
      if (!doc) throw new Error('Document not found')

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([doc.file_path])

      if (storageError) throw storageError

      // Delete database record
      const { error: deleteError } = await supabase
        .from('user_documents')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      await refreshDocuments()
    } catch (err) {
      logger.error('documents.delete.error', err, { id })
      setError(err as Error)
      throw err
    }
  }, [supabase, documents, refreshDocuments])

  const getDocumentUrl = useCallback(async (filePath: string): Promise<string | null> => {
    try {
      const { data, error: urlError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (urlError) throw urlError

      return data.signedUrl
    } catch (err) {
      console.error('Error getting document URL:', err)
      return null
    }
  }, [supabase])

  const getDocumentsByCategory = useCallback((category: string) => {
    return documents.filter(d => d.category === category)
  }, [documents])

  const getDocumentsByApplication = useCallback((submissionId: string) => {
    return documents.filter(d => d.submission_id === submissionId)
  }, [documents])

  // Initial load
  useEffect(() => {
    refreshDocuments()
  }, [refreshDocuments])

  return {
    documents,
    isLoading,
    error,
    updateDocument,
    deleteDocument,
    getDocumentUrl,
    refreshDocuments,
    getDocumentsByCategory,
    getDocumentsByApplication,
  }
}
