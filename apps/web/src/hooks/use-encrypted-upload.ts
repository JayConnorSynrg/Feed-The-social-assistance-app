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
import {
  encryptFile,
  decryptFile,
  encryptString,
  decryptString,
  type DocumentEncryptionProgress,
} from '@/lib/document-encryption'
import { logger, withMetric, createOpId } from '@/lib/logger'
import type { TextAnnotation } from '@/hooks/use-pdf-annotation'

const STORAGE_BUCKET = 'user-documents'

/** Sidecar envelope stored in encrypted_annotations */
interface AnnotationsEnvelope {
  schemaVersion: 1
  annotations: TextAnnotation[]
}

export interface UseEncryptedUploadResult {
  // Upload a file with encryption; pass annotations to store as re-editable sidecar
  uploadFile: (file: File, category: string, annotations?: TextAnnotation[]) => Promise<{
    documentId: string
    storagePath: string
  }>

  // Download and decrypt a file (legacy path — flattened or non-annotated docs)
  downloadFile: (documentId: string) => Promise<File>

  // Update only the encrypted annotations sidecar on an existing document row.
  // Does NOT re-upload the source file (source is immutable after initial upload).
  updateAnnotations: (documentId: string, annotations: TextAnnotation[]) => Promise<void>

  // Download source file + decrypt annotations sidecar for re-editing.
  downloadForEdit: (documentId: string) => Promise<{ sourceFile: File; annotations: TextAnnotation[] }>

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
   * Upload a file with encryption.
   * When annotations are provided and non-empty, encrypts them as a sidecar
   * and stores in encrypted_annotations + annotations_iv columns so the document
   * is re-editable.
   */
  const uploadFile = useCallback(
    async (
      file: File,
      category: string,
      annotations?: TextAnnotation[]
    ): Promise<{ documentId: string; storagePath: string }> => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      setIsUploading(true)
      setProgress(0)
      setError(null)

      const opId = createOpId()
      const uploadStart = performance.now()
      logger.info('document.upload.start', {
        opId,
        userId: user?.id,
        fileSizeBytes: file.size,
        category,
        encrypted: true,
      })

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

        // Step 4: Encrypt annotations sidecar if provided
        let encryptedAnnotations: string | null = null
        let annotationsIv: string | null = null

        if (annotations && annotations.length > 0) {
          const envelope: AnnotationsEnvelope = { schemaVersion: 1, annotations }
          const { ciphertext, iv } = await encryptString(JSON.stringify(envelope))
          encryptedAnnotations = ciphertext
          annotationsIv = iv
        }

        // Step 5: Save metadata to database
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
            encrypted_annotations: encryptedAnnotations,
            annotations_iv: annotationsIv,
          })
          .select('id')
          .single()

        if (dbError) {
          // Cleanup: delete uploaded file if database insert fails
          await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
          throw new Error(`Database error: ${dbError.message}`)
        }

        setProgress(100)

        logger.info('document.upload.complete', {
          opId,
          userId: user?.id,
          fileSizeBytes: file.size,
          durationMs: Math.round(performance.now() - uploadStart),
          hasAnnotations: encryptedAnnotations !== null,
          annotation_count: annotations?.length ?? 0,
        })

        return {
          documentId: documentData.id,
          storagePath,
        }
      } catch (err) {
        logger.error('document.upload.error', err, {
          opId,
          userId: user?.id,
          fileSizeBytes: file?.size,
          category,
          durationMs: Math.round(performance.now() - uploadStart),
        })
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
   * Download and decrypt a file (legacy / plain path).
   * Use downloadForEdit when the document may have encrypted annotations.
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
   * Update only the encrypted annotations sidecar on an existing document row.
   * The source file in storage is NOT touched — it is immutable after initial upload.
   * RLS on user_documents (auth.uid() = user_id) gates this UPDATE.
   */
  const updateAnnotations = useCallback(
    async (documentId: string, annotations: TextAnnotation[]): Promise<void> => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      await withMetric(
        'documents.annotations.update',
        { documentId, annotation_count: annotations.length },
        async () => {
          const envelope: AnnotationsEnvelope = { schemaVersion: 1, annotations }
          const { ciphertext, iv } = await encryptString(JSON.stringify(envelope))

          const supabase = createClient()
          const { error: dbError } = await supabase
            .from('user_documents')
            .update({
              encrypted_annotations: ciphertext,
              annotations_iv: iv,
              updated_at: new Date().toISOString(),
            })
            .eq('id', documentId)
            .eq('user_id', user.id)

          if (dbError) {
            throw new Error(`Failed to update annotations: ${dbError.message}`)
          }
        }
      ).catch((err) => {
        logger.error('documents.annotations.update.error', err, { documentId, annotation_count: annotations.length })
        throw err
      })
    },
    [user?.id]
  )

  /**
   * Download the source file and decrypt the annotations sidecar for re-editing.
   * Returns the decrypted File and the parsed TextAnnotation array.
   * If no annotations sidecar is present, returns an empty array.
   */
  const downloadForEdit = useCallback(
    async (documentId: string): Promise<{ sourceFile: File; annotations: TextAnnotation[] }> => {
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      setIsDownloading(true)
      setProgress(0)
      setError(null)

      try {
        const result = await withMetric(
          'documents.download_for_edit',
          { documentId },
          async () => {
            const supabase = createClient()

            // Fetch full row including annotation sidecar columns
            const { data: document, error: dbError } = await supabase
              .from('user_documents')
              .select('*')
              .eq('id', documentId)
              .eq('user_id', user.id)
              .single()

            if (dbError || !document) {
              throw new Error('Document not found')
            }

            if (!document.is_encrypted || !document.encryption_iv || !document.encrypted_original_name || !document.encrypted_name_iv) {
              throw new Error('Document encryption metadata is missing')
            }

            setProgress(20)

            // Download encrypted source from Storage
            const { data: fileData, error: downloadError } = await supabase.storage
              .from(STORAGE_BUCKET)
              .download(document.file_path)

            if (downloadError || !fileData) {
              throw new Error(`Download failed: ${downloadError?.message || 'Unknown error'}`)
            }

            setProgress(50)

            // Decrypt source file
            const sourceFile = await decryptFile(
              fileData,
              document.encryption_iv,
              document.encrypted_original_name,
              document.encrypted_name_iv,
              document.mime_type || 'application/octet-stream',
              (progressData: DocumentEncryptionProgress) => {
                setProgress(50 + Math.round(progressData.percentage * 0.4))
              }
            )

            setProgress(90)

            // Decrypt annotations sidecar if present
            let annotations: TextAnnotation[] = []
            if (document.encrypted_annotations && document.annotations_iv) {
              try {
                const plaintext = await decryptString(
                  document.encrypted_annotations,
                  document.annotations_iv
                )
                const envelope = JSON.parse(plaintext) as AnnotationsEnvelope
                annotations = envelope.annotations ?? []
              } catch (err) {
                logger.error('document.annotations.decrypt.error', err, { documentId })
                // Fail-open: return empty annotations rather than blocking edit
                annotations = []
              }
            }

            setProgress(100)

            return { sourceFile, annotations, has_annotations: annotations.length > 0, annotation_count: annotations.length }
          }
        )

        // Re-emit the annotation dimensions now that we have them (withMetric emits on complete)
        logger.info('documents.download_for_edit.annotations', {
          documentId,
          has_annotations: result.has_annotations,
          annotation_count: result.annotation_count,
        })

        return { sourceFile: result.sourceFile, annotations: result.annotations }
      } catch (err) {
        logger.error('documents.download_for_edit.error', err, { documentId })
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
          logger.error('document.delete.error', storageError, { userId: user?.id, documentId })
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
    updateAnnotations,
    downloadForEdit,
    deleteFile,
    isUploading,
    isDownloading,
    progress,
    error,
    clearError,
  }
}
