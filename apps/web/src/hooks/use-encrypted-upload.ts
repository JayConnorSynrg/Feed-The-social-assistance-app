/**
 * Encrypted Upload Hook
 *
 * Provides encrypted file upload/download functionality for user documents.
 * Encrypts files client-side before uploading to Supabase Storage.
 *
 * Usage:
 * const { uploadFile, downloadFile, isUploading, progress } = useEncryptedUpload()
 * await uploadFile(file, 'income')
 */

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/providers/auth-provider'
import { encryptFile, decryptFile, type DocumentEncryptionProgress } from '@/lib/document-encryption'

const STORAGE_BUCKET = 'user-documents'

export interface UseEncryptedUploadResult {
  // Upload a file with encryption
  uploadFile: (file: File, category: string) => Promise<{
    documentId: string
    storagePath: string
  }>

  // Download and decrypt a file
  downloadFile: (documentId: string) => Promise<File>

  // Delete a document
  deleteFile: (documentId: string) => Promise<void>

  // State
  isUploading: boolean
  isDownloading: boolean
  progress: number // 0-100
  error: string | null
  clearError: () => void
}

export function useEncryptedUpload(): UseEncryptedUploadResult {
  const { user } = useAuthContext()
  const [isUploading, setIsUploading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Upload a file with encryption
   */
  const uploadFile = useCallback(
    async (file: File, category: string): Promise<{ documentId: string; storagePath: string }> => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      setIsUploading(true)
      setProgress(0)
      setError(null)

      try {
        const supabase = createClient()

        // Step 1: Encrypt the file
        const encryptedResult = await encryptFile(file, (progressData: DocumentEncryptionProgress) => {
          // Encryption is 50% of total progress
          setProgress(Math.round(progressData.percentage * 0.5))
        })

        // Step 2: Generate unique storage path
        const fileExtension = '.encrypted'
        const uniqueId = crypto.randomUUID()
        const storagePath = `${user.id}/${uniqueId}${fileExtension}`

        // Step 3: Upload encrypted blob to Storage
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, encryptedResult.encryptedBlob, {
            contentType: 'application/octet-stream',
            upsert: false,
          })

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`)
        }

        setProgress(75)

        // Step 4: Save metadata to database
        const { data: documentData, error: dbError } = await supabase
          .from('user_documents')
          .insert({
            user_id: user.id,
            name: encryptedResult.originalName,
            document_type: category,
            category,
            file_path: storagePath,
            file_size: encryptedResult.originalSize,
            mime_type: encryptedResult.originalType,
            encryption_iv: encryptedResult.iv,
            encrypted_original_name: encryptedResult.encryptedName,
            encrypted_name_iv: encryptedResult.encryptedNameIV,
            original_size: encryptedResult.originalSize,
            is_encrypted: true,
          })
          .select('id')
          .single()

        if (dbError) {
          // Cleanup: delete uploaded file if database insert fails
          await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
          throw new Error(`Database error: ${dbError.message}`)
        }

        setProgress(100)

        return {
          documentId: documentData.id,
          storagePath,
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed'
        setError(errorMessage)
        throw err
      } finally {
        setIsUploading(false)
      }
    },
    [user?.id]
  )

  /**
   * Download and decrypt a file
   */
  const downloadFile = useCallback(
    async (documentId: string): Promise<File> => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      setIsDownloading(true)
      setProgress(0)
      setError(null)

      try {
        const supabase = createClient()

        // Step 1: Fetch document metadata from database
        const { data: document, error: dbError } = await supabase
          .from('user_documents')
          .select('*')
          .eq('id', documentId)
          .eq('user_id', user.id)
          .single()

        if (dbError || !document) {
          throw new Error('Document not found')
        }

        // Check if document is encrypted
        if (!document.is_encrypted) {
          throw new Error('Document is not encrypted')
        }

        if (!document.encryption_iv || !document.encrypted_original_name || !document.encrypted_name_iv) {
          throw new Error('Document encryption metadata is missing')
        }

        setProgress(25)

        // Step 2: Download encrypted file from Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .download(document.file_path)

        if (downloadError || !fileData) {
          throw new Error(`Download failed: ${downloadError?.message || 'Unknown error'}`)
        }

        setProgress(50)

        // Step 3: Decrypt the file
        const decryptedFile = await decryptFile(
          fileData,
          document.encryption_iv,
          document.encrypted_original_name,
          document.encrypted_name_iv,
          document.mime_type || 'application/octet-stream',
          (progressData: DocumentEncryptionProgress) => {
            // Decryption is 50% of total progress (50-100%)
            setProgress(50 + Math.round(progressData.percentage * 0.5))
          }
        )

        setProgress(100)

        return decryptedFile
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Download failed'
        setError(errorMessage)
        throw err
      } finally {
        setIsDownloading(false)
      }
    },
    [user?.id]
  )

  /**
   * Delete a document (from both storage and database)
   */
  const deleteFile = useCallback(
    async (documentId: string): Promise<void> => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      setError(null)

      try {
        const supabase = createClient()

        // Fetch document to get storage path
        const { data: document, error: fetchError } = await supabase
          .from('user_documents')
          .select('file_path')
          .eq('id', documentId)
          .eq('user_id', user.id)
          .single()

        if (fetchError || !document) {
          throw new Error('Document not found')
        }

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([document.file_path])

        if (storageError) {
          console.error('Failed to delete from storage:', storageError)
          // Continue with database deletion even if storage fails
        }

        // Delete from database
        const { error: dbError } = await supabase
          .from('user_documents')
          .delete()
          .eq('id', documentId)
          .eq('user_id', user.id)

        if (dbError) {
          throw new Error(`Failed to delete document: ${dbError.message}`)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Delete failed'
        setError(errorMessage)
        throw err
      }
    },
    [user?.id]
  )

  return {
    uploadFile,
    downloadFile,
    deleteFile,
    isUploading,
    isDownloading,
    progress,
    error,
    clearError,
  }
}
