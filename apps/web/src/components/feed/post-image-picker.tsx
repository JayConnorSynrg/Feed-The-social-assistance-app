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
 *
 * The field reads in the member's language (lib/i18n-feed-photo.ts) and inherits the language
 * mark of the form it sits in. The hook still stores a failure as the uploader's English sentence;
 * the field reads it as a code (photoErrorText) and marks anything it does not know English.
 *
 * The caption names the field as a group. "Uploading…" is said through a status region that is
 * on the page before its text. The button and the preview take each other's place, so when the
 * one that had the focus goes, focus moves to the other.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { uploadPostImage, deletePostImage } from '@/lib/post-image-upload'
import type { Locale } from '@/lib/i18n'
import { editT } from '@/lib/i18n-feed-edit'
import { photoErrorText, photoT } from '@/lib/i18n-feed-photo'
import { focusWasLost } from '@/lib/focus-lost'

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
  /** The viewer's language. */
  locale: Locale
}

export function PostImagePickerField({
  previewUrl,
  imageUploading,
  imageError,
  fileInputRef,
  onFileSelect,
  onClear,
  compact = false,
  locale,
}: PostImagePickerFieldProps) {
  const failure = imageError ? photoErrorText(imageError, locale) : null
  const captionId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  // The "Add a photo" button and the preview take each other's place. Whichever had the focus is
  // gone then: put it on the one that is there now (never when the member has moved elsewhere).
  const hadPreview = useRef(Boolean(previewUrl))
  useEffect(() => {
    const has = Boolean(previewUrl)
    if (has === hadPreview.current) return
    hadPreview.current = has
    if (focusWasLost(null)) (has ? previewRef : triggerRef).current?.focus()
  }, [previewUrl])
  return (
    <div role={compact ? undefined : 'group'} aria-labelledby={compact ? undefined : captionId}>
      {!compact && (
        <p id={captionId} className="mb-2 block text-sm font-medium text-stone-700">
          {photoT(locale, 'label')}
        </p>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileSelect}
        className="hidden"
        data-testid="post-image-input"
        disabled={imageUploading}
      />
      {/* On the page before an upload starts, so "Uploading…" is spoken when it does. */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="post-image-status">
        {imageUploading ? photoT(locale, 'uploading') : ''}
      </p>
      {previewUrl ? (
        <div
          ref={previewRef}
          tabIndex={-1}
          data-testid="post-image-preview"
          className="relative w-full max-w-xs overflow-hidden rounded-xl border border-stone-200 bg-stone-100 aspect-video focus:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={photoT(locale, 'previewAlt')} className="absolute inset-0 h-full w-full object-cover" />
          {imageUploading && (
            // For sighted readers (the status region above speaks); dark enough over any photo.
            <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span className="ms-2 text-xs">{photoT(locale, 'uploading')}</span>
            </div>
          )}
          {!imageUploading && (
            <button
              type="button"
              onClick={onClear}
              aria-label={editT(locale, 'removePhoto')}
              data-testid="post-image-remove"
              className="absolute top-1.5 end-1.5 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => fileInputRef.current?.click()}
          data-testid="post-image-trigger"
          className={`flex items-center gap-2 rounded-lg border border-dashed border-stone-300 text-stone-600 hover:border-[#4a5d23] hover:text-[#4a5d23] transition-colors ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
          }`}
        >
          <ImagePlus className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} aria-hidden="true" />
          {photoT(locale, 'add')}
        </button>
      )}
      {/* A sentence FEED wrote reads in the member's language; anything else is English. */}
      {failure && (
        <p role="alert" lang={failure.translated ? undefined : 'en'} dir={failure.translated ? undefined : 'ltr'} className="mt-1 text-xs text-red-700" data-testid="post-image-error">
          {failure.text}
        </p>
      )}
    </div>
  )
}
