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

import { FunctionsHttpError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { validateFileUpload } from '@/lib/security'
import { reencodeImageToWebp } from '@/lib/image-reencode'
import { logger } from '@/lib/logger'

/** The public storage bucket feed photos live in. */
export const POST_IMAGE_BUCKET = 'post-images'

/** Max ORIGINAL file the picker accepts (pre-re-encode). The stored WebP is smaller. */
export const MAX_POST_IMAGE_MB = 10

export interface PostImageUploadResult {
  url: string | null
  /** Storage object path (`<uid>/<uuid>.webp`) — used to delete on replace/remove. */
  path: string | null
  error: string | null
}

/**
 * Extract the tailored error message the edge function returned. supabase-js
 * wraps a non-2xx response as FunctionsHttpError whose `.context` is the raw
 * Response — so the JSON `{ error }` body (413 "exceeds the 5MB limit", 415
 * "not a supported image", 403 guest-block) is only reachable by reading that
 * Response. Returns null when there is no readable tailored message.
 */
export async function extractEdgeErrorMessage(error: unknown): Promise<string | null> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body && typeof body.error === 'string' && body.error.trim()) {
        return body.error
      }
    } catch {
      // Non-JSON / unreadable body — fall through to the generic message.
    }
  }
  return null
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
    return { url: null, path: null, error: check.error ?? 'That file is not a supported image.' }
  }

  // 2. Re-encode → downscaled, metadata-stripped WebP.
  let webp: Blob
  try {
    webp = await reencodeImageToWebp(file)
  } catch (err) {
    logger.error('post.image.reencode', err)
    return { url: null, path: null, error: 'Could not process that image. Please try another.' }
  }

  // 3. Upload via the validating edge function (authoritative gate).
  try {
    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke<{ url?: string; path?: string; error?: string }>(
      'post-image-upload',
      {
        body: webp,
        headers: { 'Content-Type': 'image/webp' },
      }
    )
    if (error) {
      logger.error('post.image.upload.invoke', error)
      // Surface the edge fn's tailored message (size / type / guest-block) when present.
      const tailored = await extractEdgeErrorMessage(error)
      return { url: null, path: null, error: tailored ?? 'Upload failed. Please try again.' }
    }
    if (!data?.url) {
      return { url: null, path: null, error: data?.error ?? 'Upload failed. Please try again.' }
    }
    return { url: data.url, path: data.path ?? null, error: null }
  } catch (err) {
    logger.error('post.image.upload', err)
    return { url: null, path: null, error: 'Upload failed. Please try again.' }
  }
}

/**
 * Best-effort delete of a previously-uploaded post image blob (owner-folder
 * DELETE policy). Called when the user removes or replaces the photo before
 * posting; never throws — a failed cleanup does not block the UI.
 */
export async function deletePostImage(path: string): Promise<void> {
  try {
    const supabase = createClient()
    const { error } = await supabase.storage.from(POST_IMAGE_BUCKET).remove([path])
    if (error) logger.warn('post.image.delete', { path, msg: error.message })
  } catch (err) {
    logger.warn('post.image.delete', { path, err: err instanceof Error ? err.message : 'unknown' })
  }
}
