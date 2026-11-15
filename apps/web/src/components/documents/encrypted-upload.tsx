'use client'

/**
 * Encrypted Upload Component
 *
 * File upload component with client-side encryption.
 * Integrates with vault system for zero-knowledge encryption.
 *
 * P6 W9: the words are the member's language (lib/i18n-documents.ts); the file's own name is the
 * member's text (lang="" dir="auto"). The category sent with the upload is the folder's stored
 * value, the same in every language. One always-mounted status line announces the result and one
 * always-mounted alert line shows a failure as a translated line (the hook's own sentence is read
 * as a code; storage or crypto text is never shown; document.upload.error is written by the hook).
 * Focus never falls to <body>: after an upload or Remove it returns to the file chooser, and after
 * the vault unlocks it moves to the file chooser that replaced the locked card.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Lock, FileText, Image as ImageIcon, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useEncryptedUpload } from '@/hooks/use-encrypted-upload'
import { useVault } from '@/contexts/vault-context'
import { logPredefinedEvent } from '@/lib/audit-logger'
import { VaultUnlockModal } from '@/components/vault'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { documentSize, documentsT, uploadErrorText, type DocumentsKey } from '@/lib/i18n-documents'
import { afterLayout, announce, AnnouncementText, NO_ANNOUNCEMENT, type Announcement } from '@/app/(admin)/moderation/row-focus'

interface EncryptedUploadProps {
  category: string
  onUploadComplete?: (documentId: string) => void
  className?: string
}

export function EncryptedUpload({ category, onUploadComplete, className = '' }: EncryptedUploadProps) {
  const { uploadFile, isUploading, progress, error, clearError } = useEncryptedUpload()
  const { isUnlocked } = useVault()
  const locale = useProfileLocale()
  const t = (key: DocumentsKey) => documentsT(locale, key)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [status, setStatus] = useState<Announcement>(NO_ANNOUNCEMENT)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadButtonRef = useRef<HTMLButtonElement>(null)
  const inFlight = useRef(false)
  // Set when the member unlocks from the locked card: focus then moves to the file chooser.
  const focusChooserOnUnlock = useRef(false)

  useEffect(() => {
    if (isUnlocked && focusChooserOnUnlock.current) {
      focusChooserOnUnlock.current = false
      afterLayout(() => fileInputRef.current?.focus())
    }
  }, [isUnlocked])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    clearError()
    setUploadSuccess(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      setSelectedFile(files[0])
    }
  }, [clearError])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    clearError()
    setUploadSuccess(false)
    const files = e.target.files
    if (files && files.length > 0) {
      setSelectedFile(files[0])
      // The next step is the upload button.
      afterLayout(() => uploadButtonRef.current?.focus())
    }
  }, [clearError])

  const handleUpload = useCallback(async () => {
    if (!selectedFile || inFlight.current) return
    inFlight.current = true

    try {
      const result = await uploadFile(selectedFile, category)
      setUploadSuccess(true)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      announce(setStatus, t('uploaded'))
      // The upload button has left: focus returns to the file chooser.
      afterLayout(() => fileInputRef.current?.focus())

      // Log document upload
      logPredefinedEvent('DOCUMENT_UPLOADED', {
        action: 'upload',
        resourceType: 'document',
        resourceId: result.documentId,
        details: {
          category,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
        },
      })

      // Notify parent
      if (onUploadComplete) {
        onUploadComplete(result.documentId)
      }

      // Clear success message after 3 seconds
      setTimeout(() => {
        setUploadSuccess(false)
      }, 3000)
    } catch {
      // document.upload.error is written by the hook; the alert line shows the translated failure.
      afterLayout(() => uploadButtonRef.current?.focus())
    } finally {
      inFlight.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, category, uploadFile, onUploadComplete, locale])

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    clearError()
    setUploadSuccess(false)
    afterLayout(() => fileInputRef.current?.focus())
  }, [clearError])

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="w-6 h-6" aria-hidden="true" />
    }
    return <FileText className="w-6 h-6" aria-hidden="true" />
  }

  const regions = (
    <p role="status" className="sr-only" data-testid="upload-status">
      <AnnouncementText announcement={status} />
    </p>
  )

  // Show vault locked message if vault is not unlocked
  if (!isUnlocked) {
    const openUnlockModal = () => {
      focusChooserOnUnlock.current = true
      setShowUnlockModal(true)
    }
    return (
      <>
        {regions}
        {/* A pointer can press anywhere on the card; the one control is the Unlock Vault button. */}
        <div
          data-testid="vault-locked-card"
          onClick={openUnlockModal}
          className={`p-6 rounded-xl border-2 border-dashed border-stone-500 bg-stone-50 cursor-pointer hover:border-[#4a5d23] hover:bg-[#f5f3ee] transition-colors ${className}`}
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center mb-3">
              <Lock className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="font-medium text-stone-900 mb-1">{t('vaultLocked')}</h3>
            <p className="text-sm text-stone-700 mb-4">{t('vaultLockedBody')}</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openUnlockModal() }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4a5d23] text-white text-sm font-medium hover:bg-[#3d4e1c] transition-colors"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              {t('unlockVault')}
            </button>
          </div>
        </div>
        <VaultUnlockModal
          open={showUnlockModal}
          onOpenChange={(open) => {
            if (!open) focusChooserOnUnlock.current = false
            setShowUnlockModal(open)
          }}
          onSuccess={() => setShowUnlockModal(false)}
        />
      </>
    )
  }

  const errorText = error ? uploadErrorText(error, locale) : ''

  return (
    <div className={className}>
      {regions}
      {/* Drop Zone — the file input covers it, so a press anywhere chooses a file */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative p-6 rounded-xl border-2 border-dashed transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-[#4a5d23]
          ${isDragging
            ? 'border-[#4a5d23] bg-[#4a5d23]/5'
            : 'border-stone-500 bg-[#faf9f6] hover:border-[#4a5d23] hover:bg-[#f5f3ee]'
          }
          ${isUploading ? 'pointer-events-none' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          aria-label={t('chooseFile')}
          aria-describedby="encrypted-upload-hint"
          disabled={isUploading}
          data-testid="encrypted-upload-input"
        />

        <div className="flex flex-col items-center text-center">
          {selectedFile ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-[#4a5d23]/10 text-[#4a5d23] flex items-center justify-center mb-3">
                {getFileIcon(selectedFile)}
              </div>
              <p className="font-medium text-stone-900 mb-1 max-w-full break-words" lang="" dir="auto" id="encrypted-upload-file">{selectedFile.name}</p>
              <p className="text-sm text-stone-700 mb-3">{documentSize(selectedFile.size, locale)}</p>
              {!isUploading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFile()
                  }}
                  aria-describedby="encrypted-upload-file"
                  className="relative z-10 text-stone-700 hover:text-red-700"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                  {t('removeFile')}
                </Button>
              )}
            </>
          ) : (
            <>
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors
                ${isDragging ? 'bg-[#4a5d23] text-white' : 'bg-[#4a5d23]/10 text-[#4a5d23]'}
              `}>
                <Upload className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="font-medium text-stone-900 mb-1 flex items-center gap-2">
                {isDragging ? t('dropHere') : t('uploadTitle')}
                <Lock className="w-4 h-4 text-[#4a5d23]" aria-hidden="true" />
              </p>
            </>
          )}
          <p className="text-xs text-stone-700" id="encrypted-upload-hint">{t('uploadHint')}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {isUploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-stone-800" id="encrypted-upload-progress">{t('uploadProgress')}</span>
            <span className="text-sm text-stone-700">{progress}%</span>
          </div>
          <div
            className="w-full h-2 bg-stone-200 rounded-full overflow-hidden"
            role="progressbar"
            aria-labelledby="encrypted-upload-progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full bg-[#4a5d23] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-stone-700 mt-1">
            {progress < 50 ? t('stepEncrypting') : progress < 75 ? t('stepUploading') : t('stepSaving')}
          </p>
        </div>
      )}

      {/* Error Message — always mounted, so a new failure is announced */}
      <div role="alert" data-testid="upload-alert">
        {errorText && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">{t('uploadFailed')}</p>
              <p className="text-xs text-red-800 mt-1">{errorText}</p>
            </div>
            <button
              type="button"
              onClick={() => { clearError(); fileInputRef.current?.focus() }}
              aria-label={t('dismiss')}
              className="inline-flex h-6 w-6 items-center justify-center text-red-700 hover:text-red-900"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Success Message (also announced in the status line) */}
      {uploadSuccess && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg flex items-center gap-2" aria-hidden="true">
          <CheckCircle className="w-5 h-5 text-green-700" />
          <p className="text-sm font-medium text-green-900">{t('uploaded')}</p>
        </div>
      )}

      {/* Upload Button */}
      {/* Upload Button — stays mounted (aria-disabled) while the upload runs, so focus stays on it */}
      {selectedFile && !uploadSuccess && (
        <Button
          ref={uploadButtonRef}
          type="button"
          onClick={() => { if (!isUploading) void handleUpload() }}
          aria-disabled={isUploading}
          aria-busy={isUploading || undefined}
          className={cn('w-full mt-4 gap-2', isUploading && 'bg-stone-200 text-stone-700 hover:bg-stone-200 cursor-not-allowed')}
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Lock className="w-4 h-4" aria-hidden="true" />}
          {t('encryptAndUpload')}
        </Button>
      )}

      {/* Security Notice */}
      <div className="mt-4 p-3 bg-[#4a5d23]/5 rounded-lg">
        <p className="text-xs text-stone-700 flex items-start gap-2">
          <Lock className="w-3 h-3 text-[#4a5d23] flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t('securityNotice')}</span>
        </p>
      </div>
    </div>
  )
}
