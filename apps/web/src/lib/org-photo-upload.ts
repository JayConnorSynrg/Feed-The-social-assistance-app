// apps/web/src/lib/org-photo-upload.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Organization photo I/O for the admin panel. Uploads go through the validating
// `post-image-upload?org_id=<uuid>` edge function (the only write path into the public
// `org-photos` bucket); the returned url is used verbatim, never rebuilt. Deletes go through
// storage.remove() under the org-photos manager policy and only ever touch paths inside the
// org's own `<orgId>/` folder (a second check behind the RPC's own guarantee).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { validateFileUpload } from './security'
import { reencodeImageToWebp } from './image-reencode'
import { logEvent, withMetric } from './logger'
import { newRequestId } from './privileged-action'
import { photoImageType } from './business-data'
import type { OrgFormMessages } from './i18n-org-forms'

export const ORG_PHOTO_BUCKET = 'org-photos'
export const ORG_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_ORIGINAL_MB = 10

/** Upload failure carrying the edge function's HTTP status (0 = client-side / network). */
export class OrgPhotoUploadError extends Error {
  constructor(readonly status: number) {
    super(`org photo upload failed (${status || 'client'})`)
    this.name = 'OrgPhotoUploadError'
  }
}

/** First-line client check before any upload (the edge function sniffs bytes authoritatively). */
export function isAcceptablePhoto(file: File): boolean {
  return validateFileUpload(file, {
    maxSizeMB: MAX_ORIGINAL_MB,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  }).valid
}

/** Upload status -> the message key the panel shows. */
export function uploadErrorKey(status: number): keyof OrgFormMessages {
  if (status === 413) return 'saveErrUploadTooLarge'
  if (status === 415) return 'saveErrUploadType'
  if (status === 401 || status === 403) return 'saveErrUploadDenied'
  return 'saveErrUpload'
}

function sizeBucket(bytes: number): string {
  if (bytes <= 512 * 1024) return 'le_512k'
  if (bytes <= 2 * 1024 * 1024) return 'le_2m'
  return 'le_5m'
}

/** Re-encode to WebP and upload into org-photos/<orgId>/. Returns the edge function's url + path. */
export async function uploadOrgPhoto(
  supabase: SupabaseClient<Database>,
  orgId: string,
  file: File,
): Promise<{ url: string; path: string }> {
  return withMetric(
    'org.photo.upload',
    { image_type: photoImageType(file.type), size_bucket: sizeBucket(file.size) },
    async () => {
      if (!isAcceptablePhoto(file)) throw new OrgPhotoUploadError(415)
      const webp = await reencodeImageToWebp(file)
      const requestId = newRequestId()
      const { data, error } = await supabase.functions.invoke<{ url?: string; path?: string }>(
        `post-image-upload?org_id=${encodeURIComponent(orgId)}`,
        { body: webp, headers: { 'Content-Type': 'image/webp', 'x-request-id': requestId } },
      )
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status ?? 0
        throw new OrgPhotoUploadError(typeof status === 'number' ? status : 0)
      }
      if (!data?.url || !data.path || !data.path.startsWith(`${orgId}/`)) throw new OrgPhotoUploadError(500)
      return { url: data.url, path: data.path }
    },
  )
}

/** Only the paths inside `<orgId>/`, de-duplicated. Anything else is never deleted. */
export function pathsInOrgFolder(orgId: string, paths: readonly string[]): string[] {
  const prefix = `${orgId}/`
  return [...new Set(paths.filter((p) => typeof p === 'string' && p.startsWith(prefix) && !p.includes('..')))]
}

/** Best-effort delete of org photos. Never throws; logs only a count on failure. */
export async function deleteOrgPhotos(
  supabase: SupabaseClient<Database>,
  orgId: string,
  paths: readonly string[],
): Promise<void> {
  const safe = pathsInOrgFolder(orgId, paths)
  if (safe.length === 0) return
  try {
    const { error } = await supabase.storage.from(ORG_PHOTO_BUCKET).remove(safe)
    if (error) logEvent('org.photo.cleanup_failed', { count: safe.length })
  } catch {
    logEvent('org.photo.cleanup_failed', { count: safe.length })
  }
}
