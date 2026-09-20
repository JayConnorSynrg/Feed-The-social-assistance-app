'use client'

/**
 * post-image-picker.tsx
 *
 * Shared photo-attach control for the community-feed composers (W1.2). Used by
 * BOTH the always-visible inline composer (CreatePostCard) and the wizard's
 * General Update form, so a user can attach a photo from either surface.
 *
 * The upload runs on select: the file is validated + re-encoded to a
 * downscaled, EXIF-stripped WebP and uploaded through the validating edge
 * function, so the post insert only ever carries a URL already stored + magic-
 * byte-verified server-side. When the user removes or replaces the photo before
 * posting, the previously-uploaded blob is deleted best-effort via the owner
 * DELETE policy (no orphan left behind).
 */

import React, { useCallback, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { uploadPostImage, deletePostImage } from '@/lib/post-image-upload'

export interface PostImagePickerState {
  /** Public URL of the uploaded photo (passed to the post insert), or null. */
  imageUrl: string | null
  /** Local object-URL for immediate preview, or null. */
  previewUrl: string | null
  imageUploading: boolean
  imageError: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  clearImage: () => void
  /** Clears state without attempting a blob delete (use after a successful post). */
  resetAfterPost: () => void
}

export function usePostImagePicker(): PostImagePickerState {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploadedPath, setUploadedPath] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Best-effort delete of the already-uploaded blob (replace/remove).
  const deleteUploaded = useCallback((path: string | null) => {
    if (path) void deletePostImage(path)
  }, [])

  const revokePreview = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url)
  }, [])

  const clearImage = useCallback(() => {
    deleteUploaded(uploadedPath)
    revokePreview(previewUrl)
    setPreviewUrl(null)
    setImageUrl(null)
    setUploadedPath(null)
    setImageError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [deleteUploaded, uploadedPath, revokePreview, previewUrl])

  const resetAfterPost = useCallback(() => {
    revokePreview(previewUrl)
    setPreviewUrl(null)
    setImageUrl(null)
    setUploadedPath(null)
    setImageError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [revokePreview, previewUrl])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Replace: delete the prior uploaded blob + revoke the prior preview.
    deleteUploaded(uploadedPath)
    revokePreview(previewUrl)
    setUploadedPath(null)
    setImageUrl(null)
    setImageError(null)
    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setImageUploading(true)
    try {
      const { url, path, error } = await uploadPostImage(file)
      if (error || !url) {
        setImageError(error ?? 'Could not upload that image.')
        URL.revokeObjectURL(localPreview)
        setPreviewUrl(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
      setImageUrl(url)
      setUploadedPath(path)
    } finally {
      setImageUploading(false)
    }
  }, [deleteUploaded, uploadedPath, revokePreview, previewUrl])

  return {
    imageUrl,
    previewUrl,
    imageUploading,
    imageError,
    fileInputRef,
    handleFileSelect,
    clearImage,
    resetAfterPost,
  }
}

interface PostImagePickerFieldProps {
  previewUrl: string | null
  imageUploading: boolean
  imageError: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
  /** Compact variant for the inline composer (smaller trigger). */
  compact?: boolean
}

export function PostImagePickerField({
  previewUrl,
  imageUploading,
  imageError,
  fileInputRef,
  onFileSelect,
  onClear,
  compact = false,
}: PostImagePickerFieldProps) {
  return (
    <div>
      {!compact && <label className="mb-2 block text-sm font-medium text-stone-700">Photo (optional)</label>}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileSelect}
        className="hidden"
        data-testid="post-image-input"
        disabled={imageUploading}
      />
      {previewUrl ? (
        <div className="relative w-full max-w-xs overflow-hidden rounded-xl border border-stone-200 bg-stone-100 aspect-video">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Selected photo preview" className="absolute inset-0 h-full w-full object-cover" />
          {imageUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span className="ml-2 text-xs">Uploading…</span>
            </div>
          )}
          {!imageUploading && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Remove photo"
              data-testid="post-image-remove"
              className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          data-testid="post-image-trigger"
          className={`flex items-center gap-2 rounded-lg border border-dashed border-stone-300 text-stone-600 hover:border-[#4a5d23] hover:text-[#4a5d23] transition-colors ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
          }`}
        >
          <ImagePlus className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          Add a photo
        </button>
      )}
      {imageError && <p className="mt-1 text-xs text-red-600">{imageError}</p>}
    </div>
  )
}
