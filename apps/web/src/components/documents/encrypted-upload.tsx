'use client'

/**
 * Encrypted Upload Component
 *
 * File upload component with client-side encryption.
 * Integrates with vault system for zero-knowledge encryption.
 */

import React, { useState, useRef, useCallback } from 'react'
import { Upload, Lock, FileText, Image as ImageIcon, X, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEncryptedUpload } from '@/hooks/use-encrypted-upload'
import { useVault } from '@/contexts/vault-context'
import { logPredefinedEvent } from '@/lib/audit-logger'
import { VaultUnlockModal } from '@/components/vault'

interface EncryptedUploadProps {
  category: string
  onUploadComplete?: (documentId: string) => void
  className?: string
}

export function EncryptedUpload({ category, onUploadComplete, className = '' }: EncryptedUploadProps) {
  const { uploadFile, isUploading, progress, error, clearError } = useEncryptedUpload()
  const { isUnlocked } = useVault()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    }
  }, [clearError])

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return

    try {
      const result = await uploadFile(selectedFile, category)
      setUploadSuccess(true)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

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
    } catch (err) {
      console.error('Upload failed:', err)
    }
  }, [selectedFile, category, uploadFile, onUploadComplete])

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    clearError()
    setUploadSuccess(false)
  }, [clearError])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="w-6 h-6" />
    }
    return <FileText className="w-6 h-6" />
  }

  // Show vault locked message if vault is not unlocked
  if (!isUnlocked) {
    const openUnlockModal = () => setShowUnlockModal(true)
    return (
      <>
        {/* Entire card is clickable — keyboard and pointer both open the unlock modal */}
        <div
          data-testid="vault-locked-card"
          role="button"
          tabIndex={0}
          onClick={openUnlockModal}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openUnlockModal()
            }
          }}
          className={`p-6 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 cursor-pointer hover:border-[#4a5d23]/50 hover:bg-[#f5f3ee] transition-all ${className}`}
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="font-medium text-stone-900 mb-1">Vault Locked</h3>
            <p className="text-sm text-stone-500 mb-4">
              Unlock your vault to upload encrypted documents
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); openUnlockModal() }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4a5d23] text-white text-sm font-medium hover:bg-[#3d4e1c] transition-colors"
            >
              <Lock className="w-4 h-4" />
              Unlock Vault
            </button>
          </div>
        </div>
        <VaultUnlockModal
          open={showUnlockModal}
          onOpenChange={setShowUnlockModal}
          onSuccess={() => setShowUnlockModal(false)}
        />
      </>
    )
  }

  return (
    <div className={className}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer
          ${isDragging
            ? 'border-[#4a5d23] bg-[#4a5d23]/5'
            : 'border-stone-300 bg-[#faf9f6] hover:border-[#4a5d23]/50 hover:bg-[#f5f3ee]'
          }
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center text-center">
          {selectedFile ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-[#4a5d23]/10 text-[#4a5d23] flex items-center justify-center mb-3">
                {getFileIcon(selectedFile)}
              </div>
              <p className="font-medium text-stone-900 mb-1">{selectedFile.name}</p>
              <p className="text-sm text-stone-500 mb-3">{formatFileSize(selectedFile.size)}</p>
              {!isUploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFile()
                  }}
                  className="text-stone-500 hover:text-red-600"
                >
                  <X className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              )}
            </>
          ) : (
            <>
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors
                ${isDragging ? 'bg-[#4a5d23] text-white' : 'bg-[#4a5d23]/10 text-[#4a5d23]'}
              `}>
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-medium text-stone-900 mb-1 flex items-center gap-2">
                {isDragging ? 'Drop file here' : 'Upload Encrypted Document'}
                <Lock className="w-4 h-4 text-[#4a5d23]" />
              </p>
              <p className="text-xs text-stone-500">
                Drag and drop or click to browse. Files are encrypted before upload.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {isUploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-stone-700">Encrypting and uploading...</span>
            <span className="text-sm text-stone-500">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4a5d23] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-stone-500 mt-1">
            {progress < 50 ? 'Encrypting file...' : progress < 75 ? 'Uploading...' : 'Saving metadata...'}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Upload Failed</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={clearError}
            className="text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Message */}
      {uploadSuccess && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm font-medium text-green-900">Document uploaded successfully!</p>
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && !isUploading && !uploadSuccess && (
        <Button
          onClick={handleUpload}
          className="w-full mt-4 gap-2"
        >
          <Lock className="w-4 h-4" />
          Encrypt and Upload
        </Button>
      )}

      {/* Security Notice */}
      <div className="mt-4 p-3 bg-[#4a5d23]/5 rounded-lg">
        <p className="text-xs text-stone-600 flex items-start gap-2">
          <Lock className="w-3 h-3 text-[#4a5d23] flex-shrink-0 mt-0.5" />
          <span>
            Your documents are encrypted on your device before upload. Only you can decrypt them with your vault password.
          </span>
        </p>
      </div>
    </div>
  )
}
