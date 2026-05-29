// apps/web/src/hooks/use-documents.ts
// Hook for managing user documents with Supabase Storage

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export type DocumentCategory =
  | 'identity'
  | 'income'
  | 'residence'
  | 'medical'
  | 'other'

export interface Document {
  id: string
  user_id: string
  name: string
  file_path: string
  file_type: string
  file_size: number
  category: DocumentCategory
  application_id?: string
  description?: string
  uploaded_at: string
  url?: string
}

export interface UseDocumentsReturn {
  documents: Document[]
  isLoading: boolean
  error: Error | null
  uploadDocument: (file: File, category: DocumentCategory, applicationId?: string, description?: string) => Promise<Document | null>
  deleteDocument: (id: string) => Promise<void>
  getDocumentUrl: (filePath: string) => Promise<string | null>
  refreshDocuments: () => Promise<void>
  getDocumentsByCategory: (category: DocumentCategory) => Document[]
  getDocumentsByApplication: (applicationId: string) => Document[]
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
  other: {
    label: 'Other Documents',
    icon: '📄',
    description: 'Any other supporting documents',
  },
}

export function getCategoryInfo(category: DocumentCategory) {
  return CATEGORY_INFO[category] || CATEGORY_INFO.other
}

const STORAGE_BUCKET = 'documents'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as any)
        .from('user_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })

      if (fetchError) throw fetchError

      setDocuments(data || [])
    } catch (err) {
      logger.error('documents.refresh.error', err)
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  const uploadDocument = useCallback(async (
    file: File,
    category: DocumentCategory,
    applicationId?: string,
    description?: string
  ): Promise<Document | null> => {
    try {
      // Validate file
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 10MB limit')
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error('File type not supported. Please upload PDF, JPG, PNG, or WEBP files.')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Generate unique file path
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${category}/${Date.now()}.${fileExt}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Create database record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: doc, error: insertError } = await (supabase as any)
        .from('user_documents')
        .insert({
          user_id: user.id,
          name: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
          category,
          application_id: applicationId || null,
          description: description || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      await refreshDocuments()
      return doc
    } catch (err) {
      logger.error('documents.upload.error', err, { category, applicationId })
      setError(err as Error)
      return null
    }
  }, [supabase, refreshDocuments])

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
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

  const getDocumentsByCategory = useCallback((category: DocumentCategory) => {
    return documents.filter(d => d.category === category)
  }, [documents])

  const getDocumentsByApplication = useCallback((applicationId: string) => {
    return documents.filter(d => d.application_id === applicationId)
  }, [documents])

  // Initial load
  useEffect(() => {
    refreshDocuments()
  }, [refreshDocuments])

  return {
    documents,
    isLoading,
    error,
    uploadDocument,
    deleteDocument,
    getDocumentUrl,
    refreshDocuments,
    getDocumentsByCategory,
    getDocumentsByApplication,
  }
}
