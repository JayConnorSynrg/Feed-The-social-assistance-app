'use client'

// apps/web/src/components/documents/document-upload.tsx
// Document upload component with drag-and-drop support

import React, { useState, useRef, useCallback } from 'react'
import { type DocumentCategory, getCategoryInfo } from '@/hooks/use-documents'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface DocumentUploadProps {
  onUpload: (file: File, category: DocumentCategory, description?: string) => Promise<unknown>
  applicationId?: string
  defaultCategory?: DocumentCategory
  allowedCategories?: DocumentCategory[]
  className?: string
}

export function DocumentUpload({
  onUpload,
  applicationId,
  defaultCategory = 'other',
  allowedCategories = ['identity', 'income', 'residence', 'medical', 'other'],
  className = '',
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>(defaultCategory)
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    setError(null)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      setSelectedFile(files[0])
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const files = e.target.files
    if (files && files.length > 0) {
      setSelectedFile(files[0])
    }
  }, [])

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)

    try {
      await onUpload(selectedFile, selectedCategory, description || undefined)
      // Reset form
      setSelectedFile(null)
      setDescription('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError((err as Error).message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }, [selectedFile, selectedCategory, description, onUpload])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
            className="hidden"
          />

          <div className="text-4xl mb-3">📄</div>

          {selectedFile ? (
            <div>
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedFile(null)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                className="mt-2"
              >
                Remove
              </Button>
            </div>
          ) : (
            <div>
              <p className="font-medium">Drop a file here or click to upload</p>
              <p className="text-sm text-muted-foreground mt-1">
                PDF, JPG, PNG, or WEBP up to 10MB
              </p>
            </div>
          )}
        </div>

        {/* Category Selection */}
        {selectedFile && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Category</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {allowedCategories.map(category => {
                const info = getCategoryInfo(category)
                const isSelected = selectedCategory === category

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`p-2 rounded-lg border text-left text-sm transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="mr-1">{info.icon}</span>
                    {info.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Description */}
        {selectedFile && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g., January 2026 pay stub"
              className="w-full p-2 border rounded-lg"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Upload Button */}
        {selectedFile && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full mt-4"
          >
            {isUploading ? 'Uploading...' : 'Upload Document'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// Quick upload button for inline use
interface QuickUploadButtonProps {
  onUpload: (file: File, category: DocumentCategory) => Promise<unknown>
  category: DocumentCategory
  label?: string
}

export function QuickUploadButton({
  onUpload,
  category,
  label = 'Upload',
}: QuickUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      await onUpload(file, category)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleChange}
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? 'Uploading...' : label}
      </Button>
    </>
  )
}
