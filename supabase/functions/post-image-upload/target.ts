/**
 * Pure upload-target logic for the post-image-upload edge function.
 *
 * Dependency-free (no Deno.serve, no Deno-only imports, no top-level side
 * effects) so it runs under the Deno edge runtime via a relative import and
 * can be unit-tested under vitest or deno test.
 *
 * Two targets:
 *   - post: no `org_id` query param → post-images/<uid>/<uuid>.<ext>
 *     (the original feed-post behavior).
 *   - org:  `org_id=<uuid>` → org-photos/<org_id>/<uuid>.<ext>, written only
 *     after the caller passes can_manage_org_photos(org_id) under their own JWT.
 */

export const POST_BUCKET = 'post-images'
export const ORG_BUCKET = 'org-photos'

export type UploadTarget =
  | { kind: 'post' }
  | { kind: 'org'; orgId: string }
  | { kind: 'invalid' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolve the upload target from the request's query string.
 * - no `org_id` param → post
 * - exactly one `org_id` that is a UUID → org (lowercased so each org maps to
 *   exactly one storage folder)
 * - anything else (empty, malformed, repeated) → invalid
 */
export function parseUploadTarget(params: URLSearchParams): UploadTarget {
  const values = params.getAll('org_id')
  if (values.length === 0) return { kind: 'post' }
  if (values.length > 1) return { kind: 'invalid' }
  const raw = values[0].trim()
  if (!UUID_RE.test(raw)) return { kind: 'invalid' }
  return { kind: 'org', orgId: raw.toLowerCase() }
}

/**
 * Build the bucket + object path for a validated target. The folder is the
 * caller's uid for posts and the validated org UUID for org photos; the file
 * name is always a fresh server-minted UUID.
 */
export function buildObjectPath(
  target: { kind: 'post'; userId: string } | { kind: 'org'; orgId: string },
  ext: string,
  fileId: string,
): { bucket: string; path: string } {
  if (target.kind === 'org') {
    return { bucket: ORG_BUCKET, path: `${target.orgId}/${fileId}.${ext}` }
  }
  return { bucket: POST_BUCKET, path: `${target.userId}/${fileId}.${ext}` }
}

/** Coarse size bucket for logs (exact sizes and file names stay out of logs). */
export function sizeBucket(bytes: number): string {
  if (bytes <= 0) return 'empty'
  if (bytes < 100 * 1024) return '<100KB'
  if (bytes < 1024 * 1024) return '100KB-1MB'
  if (bytes <= 5 * 1024 * 1024) return '1-5MB'
  return '>5MB'
}

/** The caller as the upload gate sees it (from auth.getUser under the caller's JWT). */
export interface UploadCaller {
  id: string
  is_anonymous?: boolean | null
}

export type UploadDecision =
  | { allow: true; bucket: string; folder: string; dest: { kind: 'post'; userId: string } | { kind: 'org'; orgId: string } }
  | { allow: false; status: 400 | 401 | 403; reason: 'auth.rejected' | 'anon.blocked' | 'org_id.invalid' | 'forbidden'; error: string }

/**
 * The authorization decision for one upload, before any byte is read or written:
 *  - no caller -> 401; a guest (anonymous) caller -> 403;
 *  - a malformed org_id -> 400;
 *  - an org target needs `canManage === true` (can_manage_org_photos under the caller's own JWT),
 *    otherwise 403 and nothing is written;
 *  - allowed: post -> post-images/<uid>/, org -> org-photos/<org_id>/.
 */
export function decideUpload(input: {
  user: UploadCaller | null
  target: UploadTarget
  canManage: boolean
}): UploadDecision {
  const { user, target, canManage } = input
  if (!user) return { allow: false, status: 401, reason: 'auth.rejected', error: 'Unauthorized' }
  if (user.is_anonymous === true) {
    return { allow: false, status: 403, reason: 'anon.blocked', error: 'Create a free account to attach a photo.' }
  }
  if (target.kind === 'invalid') return { allow: false, status: 400, reason: 'org_id.invalid', error: 'Invalid org_id.' }
  if (target.kind === 'org') {
    if (canManage !== true) {
      return { allow: false, status: 403, reason: 'forbidden', error: 'You cannot manage photos for this organization.' }
    }
    return { allow: true, bucket: ORG_BUCKET, folder: `${target.orgId}/`, dest: target }
  }
  return { allow: true, bucket: POST_BUCKET, folder: `${user.id}/`, dest: { kind: 'post', userId: user.id } }
}
