// apps/web/src/lib/post-image-upload.ts
//
// Client flow for attaching a photo to a community-feed post (INV-M1 write side).
//
//   1. First-line client validation (declared type / extension / size).
//   2. Re-encode to a downscaled, EXIF-stripped WebP (INV-M4).
//   3. Upload the re-encoded bytes to the `post-image-upload` edge function,
//      which performs the AUTHORITATIVE server-side magic-byte validation and
//      writes to the public `post-images` bucket via the service_role.
//
// The client NEVER writes to storage directly — there is no direct-INSERT RLS
// policy on `post-images`; the edge function is the only ingestion path.

import { createClient } from '@/lib/supabase/client'
import { validateFileUpload } from '@/lib/security'
import { reencodeImageToWebp } from '@/lib/image-reencode'
import { logger } from '@/lib/logger'

/** Max ORIGINAL file the picker accepts (pre-re-encode). The stored WebP is smaller. */
export const MAX_POST_IMAGE_MB = 10

export interface PostImageUploadResult {
  url: string | null
  error: string | null
}

/**
 * Validate, re-encode, and upload a user-selected image for a feed post.
 * Returns the public URL on success, or a friendly error message.
 */
export async function uploadPostImage(file: File): Promise<PostImageUploadResult> {
  // 1. First-line client check (bypassable — the edge fn is authoritative).
  const check = validateFileUpload(file, {
    maxSizeMB: MAX_POST_IMAGE_MB,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  })
  if (!check.valid) {
    return { url: null, error: check.error ?? 'That file is not a supported image.' }
  }

  // 2. Re-encode → downscaled, metadata-stripped WebP.
  let webp: Blob
  try {
    webp = await reencodeImageToWebp(file)
  } catch (err) {
    logger.error('post.image.reencode', err)
    return { url: null, error: 'Could not process that image. Please try another.' }
  }

  // 3. Upload via the validating edge function (authoritative gate).
  try {
    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
      'post-image-upload',
      {
        body: webp,
        headers: { 'Content-Type': 'image/webp' },
      }
    )
    if (error) {
      logger.error('post.image.upload.invoke', error)
      return { url: null, error: 'Upload failed. Please try again.' }
    }
    if (!data?.url) {
      return { url: null, error: data?.error ?? 'Upload failed. Please try again.' }
    }
    return { url: data.url, error: null }
  } catch (err) {
    logger.error('post.image.upload', err)
    return { url: null, error: 'Upload failed. Please try again.' }
  }
}
