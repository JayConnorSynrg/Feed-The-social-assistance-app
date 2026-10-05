// supabase/functions/post-image-upload/index.ts
//
// Authoritative ingestion path for community-feed post images (FEED P2 W1.2).
//
// SECURITY (INV-M1 / INV-M2): the `post-images` bucket is PUBLIC and has NO
// direct-client INSERT RLS policy. This function is the ONLY write path, so it
// is where every guarantee is enforced, server-side:
//
//   1. Auth: the caller's JWT is verified in-code (the function is deployed
//      --no-verify-jwt so the gateway does not reject before this runs; auth is
//      handled here, mirroring the project's edge-auth pattern).
//   2. Guest block: an anonymous (is_anonymous) user is rejected (INV-M2).
//   3. Magic bytes: the raw uploaded bytes are sniffed (JPEG / PNG / WebP). A
//      forged content-type (e.g. SVG/HTML labelled image/webp → stored XSS on a
//      public bucket) is rejected because the bytes are inspected, not the
//      header (INV-M1).
//   4. Size cap: bytes over the limit are rejected (defense-in-depth with the
//      bucket's file_size_limit).
//   5. Write: the object is written via the service_role to
//      post-images/<uid>/<uuid>.<ext> (owner-folder path). The public URL is
//      returned to the client, which stores it in posts.image_url.
//
// ORGANIZATION PHOTOS (`?org_id=<uuid>`): the same function is the only write
// path for the public `org-photos` bucket. With org_id present:
//   - org_id must be a UUID (else 400);
//   - the CALLER, under their own JWT, must pass
//     rpc('can_manage_org_photos', { p_folder: org_id }) (false/error → 403);
//   - checks 1-4 above still apply, then the service_role writes to
//     org-photos/<org_id>/<uuid>.<ext> and returns { url, path, bucket }.
// Without org_id the post-image behavior above is unchanged.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { edgeLog, getCorrelationId } from '../_shared/log.ts'
import { ORG_BUCKET, buildObjectPath, decideUpload, parseUploadTarget, sizeBucket } from './target.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB — mirrors the bucket file_size_limit

type ImageType = 'jpeg' | 'png' | 'webp'

/**
 * Sniff image magic bytes. This is the AUTHORITATIVE server-side gate — the
 * client re-encode (canvas → WebP) plus validateFileUpload is the first-line
 * check; the bytes are re-verified here before anything lands in the public
 * bucket. Fixed format constants (JPEG / PNG / WebP).
 */
function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length < 12) return null
  // JPEG — FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  // PNG — 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'png'
  // WebP — "RIFF"....."WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'webp'
  return null
}

function extFor(type: ImageType): string {
  return type === 'jpeg' ? 'jpg' : type
}

function json(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin, 'post-image-upload')
  const requestId = getCorrelationId(req)
  const respHeaders = { ...corsHeaders, 'x-request-id': requestId }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: respHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, respHeaders)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401, respHeaders)
  }

  // Target: no org_id → post image (original behavior); org_id → org photo.
  const target = parseUploadTarget(new URL(req.url).searchParams)
  const isPost = target.kind === 'post'
  // Org-path log line: outcome + bucket + size bucket only (no user ids, no paths).
  const orgLog = (level: 'info' | 'warn' | 'error', outcome: string, size?: number, msg?: string) =>
    edgeLog(level, `org_photo.${outcome}`, {
      requestId,
      bucket: ORG_BUCKET,
      ...(size !== undefined ? { sizeBucket: sizeBucket(size) } : {}),
      ...(msg !== undefined ? { msg } : {}),
    })

  try {
    // 1. Verify the caller's JWT in-code.
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: authUser }, error: authError } = await supabaseUser.auth.getUser()
    const user = authError ? null : authUser

    // 2. Org photos: the caller (own JWT, not service_role) must be allowed to manage that org's
    //    photo folder. Asked only for a signed-in, non-guest caller with a valid org target.
    let canManage = false
    let rpcMessage: string | undefined
    if (user && user.is_anonymous !== true && target.kind === 'org') {
      const { data: allowed, error: rpcError } = await supabaseUser.rpc('can_manage_org_photos', {
        p_folder: target.orgId,
      })
      canManage = !rpcError && allowed === true
      rpcMessage = rpcError?.message
    }

    // 2b. One decision: 401 no caller, 403 guest (INV-M2), 400 bad org_id, 403 not a manager.
    const decision = decideUpload({ user, target, canManage })
    if (!decision.allow) {
      if (isPost && decision.reason === 'auth.rejected') edgeLog('warn', 'post_image.auth.rejected', { requestId })
      else if (isPost) edgeLog('warn', 'post_image.anon.blocked', { requestId, userId: user?.id })
      else orgLog('warn', decision.reason, undefined, decision.reason === 'forbidden' ? rpcMessage : undefined)
      return json({ error: decision.error }, decision.status, respHeaders)
    }
    if (!user) return json({ error: 'Unauthorized' }, 401, respHeaders)

    // 3/4. Read bytes, enforce size, sniff magic bytes.
    const buf = new Uint8Array(await req.arrayBuffer())
    if (buf.byteLength === 0) {
      if (!isPost) orgLog('warn', 'empty', 0)
      return json({ error: 'Empty upload.' }, 400, respHeaders)
    }
    if (buf.byteLength > MAX_BYTES) {
      if (isPost) edgeLog('warn', 'post_image.too_large', { requestId, userId: user.id, size: buf.byteLength })
      else orgLog('warn', 'too_large', buf.byteLength)
      return json({ error: 'Image exceeds the 5MB limit.' }, 413, respHeaders)
    }
    const imageType = sniffImageType(buf)
    if (!imageType) {
      if (isPost) edgeLog('warn', 'post_image.not_an_image', { requestId, userId: user.id, size: buf.byteLength })
      else orgLog('warn', 'not_an_image', buf.byteLength)
      return json({ error: 'That file is not a supported image.' }, 415, respHeaders)
    }

    // 5. Write via service_role: post-images/<uid>/… or org-photos/<org_id>/….
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { bucket, path } = buildObjectPath(
      decision.dest,
      extFor(imageType),
      crypto.randomUUID(),
    )
    const contentType = `image/${imageType}`
    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(path, buf, { contentType, cacheControl: '3600', upsert: false })
    if (uploadError) {
      if (isPost) edgeLog('error', 'post_image.upload_failed', { requestId, userId: user.id, msg: uploadError.message })
      else orgLog('error', 'upload_failed', buf.byteLength, uploadError.message)
      return json({ error: 'Upload failed.' }, 500, respHeaders)
    }

    const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(path)
    if (isPost) {
      edgeLog('info', 'post_image.uploaded', { requestId, userId: user.id, path, type: imageType, size: buf.byteLength })
      // `path` is returned so the client can delete the object it just created
      // (owner-folder DELETE policy) when the user removes or replaces the photo.
      return json({ url: publicUrl, path }, 200, respHeaders)
    }
    orgLog('info', 'uploaded', buf.byteLength)
    return json({ url: publicUrl, path, bucket }, 200, respHeaders)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (isPost) edgeLog('error', 'post_image.unexpected', { requestId, msg })
    else orgLog('error', 'unexpected', undefined, msg)
    return json({ error: 'Internal server error' }, 500, respHeaders)
  }
})
