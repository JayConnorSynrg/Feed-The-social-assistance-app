/**
 * federation-resources — inbound edge function
 *
 * Serves local approved resources to authenticated federation partners.
 * Replaces the privileged logic that previously lived in the Next.js
 * apps/web/src/app/api/federation/resources/route.ts (+ [id]/route.ts).
 *
 * The Next.js route is now a thin proxy that forwards the original
 * Signature, Date, Host, and Digest headers plus two passthrough headers:
 *   x-original-host   — the Host the signer used (required for cavage verification)
 *   x-original-target — "<METHOD> <path+query>" the signer used
 *
 * Auth: draft-cavage HTTP Signature verification against the peer's
 *       public key stored in federated_instances.
 *
 * verify_jwt = false (set in config.toml) — auth is via HTTP Signature.
 *
 * Rate-limit Tier 0: the signature gate rejects all unsigned/unknown
 * callers before any DB read. Upstash Redis keyed by instance.id is the
 * documented upgrade once federation_peers > 0.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import {
  serviceClient,
  corsPreflightResponse,
  withCors,
  FEDERATION_CORS_HEADERS,
} from '../_shared/federation-db.ts'

// ---------------------------------------------------------------------------
// Cavage signature verifier (WebCrypto / Deno)
// ---------------------------------------------------------------------------

interface SignatureParams {
  keyId: string
  algorithm: string
  headers: string[]
  signature: string
  created?: number
  expires?: number
}

function parseSignatureHeader(header: string): SignatureParams | null {
  try {
    const params: Partial<SignatureParams> = {}
    const regex = /(\w+)=(?:"([^"]+)"|(\d+))/g
    let match
    while ((match = regex.exec(header)) !== null) {
      const [, key, quotedValue, numericValue] = match
      const value = quotedValue ?? numericValue
      switch (key) {
        case 'keyId':    params.keyId = value; break
        case 'algorithm': params.algorithm = value; break
        case 'headers':  params.headers = value.split(' '); break
        case 'signature': params.signature = value; break
        case 'created':  params.created = parseInt(value, 10); break
        case 'expires':  params.expires = parseInt(value, 10); break
      }
    }
    if (!params.keyId || !params.signature || !params.headers) return null
    return params as SignatureParams
  } catch {
    return null
  }
}

/** Import a PEM RSA public key (SPKI) using SubtleCrypto. */
async function importPublicKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '')
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  )
}

interface VerifyContext {
  /** draft-cavage (request-target): method + path */
  method: string
  path: string
  /** All request headers (lower-cased) */
  headers: Record<string, string>
}

/** Rebuild the signing string that was used to produce the Signature. */
function buildSigningString(ctx: VerifyContext, params: SignatureParams): string {
  const parts: string[] = []
  for (const h of params.headers) {
    if (h === '(request-target)') {
      parts.push(`(request-target): ${ctx.method.toLowerCase()} ${ctx.path}`)
    } else if (h === '(created)') {
      parts.push(`(created): ${params.created}`)
    } else if (h === '(expires)') {
      parts.push(`(expires): ${params.expires}`)
    } else {
      const val = ctx.headers[h.toLowerCase()]
      if (val !== undefined) parts.push(`${h.toLowerCase()}: ${val}`)
    }
  }
  return parts.join('\n')
}

async function verifyCavageSignature(
  signatureHeader: string,
  publicKeyPem: string,
  ctx: VerifyContext
): Promise<boolean> {
  try {
    const params = parseSignatureHeader(signatureHeader)
    if (!params) return false

    // Replay-window: reject signatures older than 5 minutes
    const now = Math.floor(Date.now() / 1000)
    if (params.expires && params.expires < now) return false
    if (params.created && now - params.created > 300) return false

    const signingString = buildSigningString(ctx, params)
    const pubKey = await importPublicKey(publicKeyPem)

    const sigBytes = Uint8Array.from(atob(params.signature), (c) => c.charCodeAt(0))
    return crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      pubKey,
      sigBytes,
      new TextEncoder().encode(signingString)
    )
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Trust level gate
// ---------------------------------------------------------------------------

const TRUST_LEVELS = ['untrusted', 'pending', 'trusted', 'verified', 'core']

function meetsTrustLevel(
  actual: string | null,
  minimum: string
): boolean {
  const ai = TRUST_LEVELS.indexOf(actual ?? 'untrusted')
  const mi = TRUST_LEVELS.indexOf(minimum)
  return ai >= mi
}

// ---------------------------------------------------------------------------
// Response shape helpers
// ---------------------------------------------------------------------------

interface FederationResource {
  id: string
  name: string
  description: string | null
  resource_type: string
  address_line1: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  email: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  hours_of_operation: unknown
  updated_at: string
  created_at: string
}

// deno-lint-ignore no-explicit-any
function toFederationResource(row: Record<string, any>): FederationResource {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    resource_type: row.category ?? '',
    address_line1: row.address_line1 ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    zip_code: row.zip_code ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    website: row.website ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    hours_of_operation: row.hours_of_operation ?? null,
    updated_at: row.updated_at ?? '',
    created_at: row.created_at ?? '',
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return withCors(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()

  // ---- 1. Reconstruct original host + request-target from proxy headers ----
  // The Next.js thin proxy sets these so we verify against what the signer saw,
  // not the edge-function URL (which the signer never knew about).
  const originalHost = req.headers.get('x-original-host')
  const originalTarget = req.headers.get('x-original-target') // e.g. "GET /api/federation/resources?since=..."

  if (!originalHost || !originalTarget) {
    return jsonResponse(
      { error: 'Missing x-original-host or x-original-target proxy headers' },
      400
    )
  }

  // Parse "METHOD /path?query" → { method, path }
  const targetParts = originalTarget.split(' ')
  if (targetParts.length < 2) {
    return jsonResponse({ error: 'Malformed x-original-target header' }, 400)
  }
  const [originalMethod, originalPath] = targetParts

  if (originalMethod !== 'GET') {
    return jsonResponse({ error: 'Only GET is supported' }, 405)
  }

  // ---- 2. Extract Signature header ----
  const signatureHeader = req.headers.get('signature') ?? req.headers.get('authorization')
  if (!signatureHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing Signature header', code: 'MISSING_SIGNATURE' }),
      {
        status: 401,
        headers: {
          ...FEDERATION_CORS_HEADERS,
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Signature realm="FEED Federation"',
        },
      }
    )
  }

  // ---- 3. Extract keyId → instance URL ----
  const params = parseSignatureHeader(signatureHeader)
  if (!params?.keyId) {
    return jsonResponse({ error: 'Cannot extract keyId from Signature header', code: 'INVALID_SIGNATURE' }, 401)
  }

  const instanceUrl = params.keyId.split('#')[0]
  if (!instanceUrl) {
    return jsonResponse({ error: 'Malformed keyId in Signature header', code: 'INVALID_SIGNATURE' }, 401)
  }

  // ---- 4. Look up instance ----
  const supabase = serviceClient()

  const { data: instance, error: instanceErr } = await supabase
    .from('federated_instances')
    .select('id, instance_url, instance_name, public_key, status')
    .eq('instance_url', instanceUrl)
    .single()

  if (instanceErr || !instance) {
    return jsonResponse({ error: `Unknown federation instance: ${instanceUrl}`, code: 'UNKNOWN_INSTANCE' }, 403)
  }

  if (instance.status === 'blocked' || instance.status === 'suspended') {
    return jsonResponse({ error: `Instance is ${instance.status}`, code: 'BLOCKED_INSTANCE' }, 403)
  }

  // ---- 5. Verify cavage Signature using original host + path ----
  // Rebuild the header map as the signer constructed it (host = originalHost).
  const allHeaders: Record<string, string> = {}
  req.headers.forEach((v, k) => { allHeaders[k.toLowerCase()] = v })
  // Override host with what the signer used
  allHeaders['host'] = originalHost

  const valid = await verifyCavageSignature(signatureHeader, instance.public_key, {
    method: originalMethod,
    path: originalPath,
    headers: allHeaders,
  })

  if (!valid) {
    return new Response(
      JSON.stringify({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' }),
      {
        status: 401,
        headers: {
          ...FEDERATION_CORS_HEADERS,
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Signature realm="FEED Federation"',
        },
      }
    )
  }

  // ---- 6. Look up trust level ----
  const { data: localInstance } = await supabase
    .from('federated_instances')
    .select('id')
    .eq('is_local', true)
    .single()

  let trustLevel: string | null = null

  if (localInstance) {
    const { data: peer } = await supabase
      .from('federation_peers')
      .select('trust_level')
      .eq('local_instance_id', localInstance.id)
      .eq('remote_instance_id', instance.id)
      .single()

    trustLevel = peer?.trust_level ?? null
  }

  if (!meetsTrustLevel(trustLevel, 'pending')) {
    return jsonResponse(
      {
        error: 'Insufficient trust level',
        message: 'Your instance must have at least pending trust level to access resources',
        required_level: 'pending',
        current_level: trustLevel ?? 'untrusted',
      },
      403
    )
  }

  // ---- 7. Update last_seen_at ----
  await supabase
    .from('federated_instances')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', instance.id)

  // ---- 8. Parse query params from original path ----
  const queryStr = originalPath.includes('?') ? originalPath.split('?')[1] : ''
  const searchParams = new URLSearchParams(queryStr)

  // Check if this is a single-resource request: path ends with a UUID segment
  const pathPart = originalPath.split('?')[0]
  const segments = pathPart.split('/').filter(Boolean)
  const lastSeg = segments[segments.length - 1]
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const isSingleResource = uuidPattern.test(lastSeg)

  // ---- 9. Serve single resource ----
  if (isSingleResource) {
    const resourceId = lastSeg
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('id', resourceId)
      .eq('status', 'approved')
      .single()

    if (error || !data) {
      return jsonResponse({ error: 'Resource not found' }, 404)
    }

    return jsonResponse(toFederationResource(data as Record<string, unknown>))
  }

  // ---- 10. Serve collection with paging ----
  const sinceParam = searchParams.get('since')
  const category = searchParams.get('category') ?? undefined
  const limitParam = searchParams.get('limit')
  const cursorParam = searchParams.get('cursor')

  let limit = 100
  if (limitParam) {
    const p = parseInt(limitParam, 10)
    if (!isNaN(p) && p > 0) limit = Math.min(p, 1000)
  }

  let cursor: string | undefined
  if (cursorParam) {
    try {
      cursor = atob(cursorParam)
    } catch { /* invalid cursor — ignore */ }
  }

  let sinceDate: string | undefined
  if (sinceParam) {
    const d = new Date(sinceParam)
    if (!isNaN(d.getTime())) sinceDate = d.toISOString()
  }

  // Build query
  // deno-lint-ignore no-explicit-any
  let query = (supabase as any)
    .from('resources')
    .select('*')
    .eq('status', 'approved')
    .eq('is_verified', true)
    .order('id', { ascending: true })
    .limit(limit + 1)

  if (sinceDate) query = query.gt('updated_at', sinceDate)
  if (category)  query = query.eq('category', category)
  if (cursor)    query = query.gt('id', cursor)

  const { data: rows, error: queryErr } = await query

  if (queryErr) {
    return jsonResponse({ error: 'Failed to fetch resources', details: queryErr.message }, 500)
  }

  const allRows = (rows ?? []) as Record<string, unknown>[]
  const hasMore = allRows.length > limit
  const results = allRows.slice(0, limit)

  // Estimated total count
  const { count } = await supabase
    .from('resources')
    .select('*', { count: 'estimated', head: true })
    .eq('status', 'approved')
    .eq('is_verified', true)

  const lastId = results.length > 0 ? (results[results.length - 1] as Record<string, unknown>).id as string : null

  return jsonResponse({
    resources: results.map(toFederationResource),
    cursor: hasMore && lastId ? btoa(lastId) : null,
    has_more: hasMore,
    total: count ?? 0,
  })
})
