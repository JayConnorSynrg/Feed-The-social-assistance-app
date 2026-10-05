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
