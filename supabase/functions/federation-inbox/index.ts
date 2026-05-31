/**
 * federation-inbox — inbound edge function
 *
 * Receives webhook notifications from federation partners when their
 * resources change. Replaces the privileged logic that previously lived in
 * apps/web/src/app/api/federation/webhook/route.ts.
 *
 * The Next.js route is now a thin proxy that forwards:
 *   X-Federation-Signature, X-Federation-Event, Content-Type, User-Agent
 *   x-original-host   — original Host header (informational; not used in HMAC)
 *   x-original-target — "POST /api/federation/webhook"
 *
 * Auth: HMAC-SHA256 over raw body.
 *   Key = FEDERATION_PRIVATE_KEY[:64]
 *   Header = X-Federation-Signature: sha256=<hex>
 *   (self-consistent sender/receiver scheme — see federation-webhook edge fn
 *    and webhook/route.ts history)
 *
 * verify_jwt = false (set in config.toml) — auth is via HMAC.
 *
 * Rate-limit Tier 0: the HMAC gate rejects all unsigned/unknown callers
 * before any DB write occurs. Upstash Redis keyed by verified instance.id
 * is the documented upgrade once federation_peers > 0.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import {
  serviceClient,
  corsPreflightResponse,
  withCors,
} from '../_shared/federation-db.ts'

// ---------------------------------------------------------------------------
// HMAC verifier
// ---------------------------------------------------------------------------

/** Constant-time hex comparison to prevent timing attacks. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/** Compute HMAC-SHA256 of body using secret, return hex string. */
async function computeHmacHex(secret: string, body: string): Promise<string> {
  const keyData = new TextEncoder().encode(secret)
  const msgData = new TextEncoder().encode(body)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, msgData)
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifyHmac(body: string, signatureHeader: string, secret: string): Promise<boolean> {
  try {
    const expected = await computeHmacHex(secret, body)
    // Strip optional "sha256=" prefix
    const received = signatureHeader.replace(/^sha256=/, '')
    return constantTimeEqual(expected, received)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Payload validation
// ---------------------------------------------------------------------------

const VALID_EVENTS = ['resource.created', 'resource.updated', 'resource.deleted'] as const
type WebhookEvent = typeof VALID_EVENTS[number]

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface WebhookPayload {
  event: WebhookEvent
  instance_id: string
  instance_url: string
  resource_id: string
  resource_type: string
  timestamp: string
  signature: string
}

function validatePayload(raw: unknown): { ok: true; data: WebhookPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Payload must be a JSON object' }

  const p = raw as Record<string, unknown>
  const required = ['event', 'instance_id', 'instance_url', 'resource_id', 'resource_type', 'timestamp', 'signature']

  for (const field of required) {
    if (!p[field] || typeof p[field] !== 'string') {
      return { ok: false, error: `Missing or invalid field: ${field}` }
    }
  }

  if (!VALID_EVENTS.includes(p.event as WebhookEvent)) {
    return { ok: false, error: `Invalid event type. Must be one of: ${VALID_EVENTS.join(', ')}` }
  }

  const ts = new Date(p.timestamp as string)
  if (isNaN(ts.getTime())) return { ok: false, error: 'Invalid timestamp format' }

  const age = Date.now() - ts.getTime()
  if (age > MAX_TIMESTAMP_AGE_MS) return { ok: false, error: `Timestamp too old (max age: ${MAX_TIMESTAMP_AGE_MS / 1000}s)` }
  if (age < -60_000) return { ok: false, error: 'Timestamp is in the future' }

  if (!UUID_PATTERN.test(p.instance_id as string)) return { ok: false, error: 'Invalid instance_id format (must be UUID)' }
  if (!UUID_PATTERN.test(p.resource_id as string)) return { ok: false, error: 'Invalid resource_id format (must be UUID)' }

  try { new URL(p.instance_url as string) } catch {
    return { ok: false, error: 'Invalid instance_url format' }
  }

  return { ok: true, data: p as unknown as WebhookPayload }
}

// ---------------------------------------------------------------------------
// JSON helper
// ---------------------------------------------------------------------------

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

  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  // ---- 1. Read env ----
  const privateKey = Deno.env.get('FEDERATION_PRIVATE_KEY')
  if (!privateKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  // ---- 2. Read raw body (required for HMAC) ----
  const bodyText = await req.text()

  // ---- 3. Parse JSON ----
  let rawPayload: unknown
  try {
    rawPayload = JSON.parse(bodyText)
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400)
  }

  // ---- 4. Validate structure ----
  const validation = validatePayload(rawPayload)
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400)
  }
  const payload = validation.data

  // ---- 5. Verify HMAC ----
  const sigHeader = req.headers.get('x-federation-signature') ?? req.headers.get('X-Federation-Signature')
  if (!sigHeader) {
    return jsonResponse({ error: 'Missing X-Federation-Signature header' }, 401)
  }

  // HMAC key = first 64 chars of FEDERATION_PRIVATE_KEY (mirrors webhook/route.ts)
  const hmacKey = privateKey.substring(0, 64)
  const hmacValid = await verifyHmac(bodyText, sigHeader, hmacKey)
  if (!hmacValid) {
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  // ---- 6. Look up instance ----
  const supabase = serviceClient()

  const { data: instance, error: instanceErr } = await supabase
    .from('federated_instances')
    .select('id, instance_url, instance_name, public_key, status')
    .eq('id', payload.instance_id)
    .single()

  if (instanceErr || !instance) {
    return jsonResponse({ error: `Unknown instance: ${payload.instance_id}`, details: instanceErr?.message }, 404)
  }

  if (instance.status !== 'active') {
    return jsonResponse({ error: `Instance is not active (status: ${instance.status})` }, 403)
  }

  if (instance.instance_url !== payload.instance_url) {
    return jsonResponse(
      { error: 'Instance URL mismatch', expected: instance.instance_url, received: payload.instance_url },
      400
    )
  }

  // ---- 7. Process event ----
  let actionTaken: 'upserted' | 'deleted' | 'logged' = 'logged'
  let processSuccess = false
  let processError: string | undefined

  try {
    switch (payload.event) {
      case 'resource.created':
      case 'resource.updated': {
        // Fetch the resource from the partner using a cavage-signed GET.
        // Import signer from _shared (same signing scheme as federation-sync).
        const { signRequest } = await import('../_shared/http-signatures.ts')

        const resourceUrl = `${instance.instance_url}/api/federation/resources/${payload.resource_id}`
        const selfUrl = Deno.env.get('APP_URL') ?? Deno.env.get('SUPABASE_URL') ?? 'http://localhost:3000'
        const keyId = `${selfUrl}#main-key`

        const signedHeaders = await signRequest({
          privateKeyPem: privateKey,
          method: 'GET',
          url: resourceUrl,
          keyId,
        })

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30_000)

        let fetchedResource: Record<string, unknown> | null = null
        try {
          const resp = await fetch(resourceUrl, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'User-Agent': 'FEED-Federation/1.0',
              Signature: signedHeaders.Signature,
              Host: signedHeaders.Host,
              Date: signedHeaders.Date,
            },
            signal: controller.signal,
          })
          clearTimeout(timeout)
          if (resp.ok) {
            fetchedResource = await resp.json()
          } else {
            processError = `Failed to fetch resource from partner: HTTP ${resp.status}`
          }
        } catch (err) {
          clearTimeout(timeout)
          processError = err instanceof Error ? err.message : 'Fetch failed'
        }

        if (!fetchedResource) {
          actionTaken = 'logged'
          break
        }

        const r = fetchedResource
        const { error: upsertErr } = await supabase
          .from('federated_resources')
          .upsert(
            {
              source_instance_id: instance.id,
              source_resource_id: payload.resource_id,
              name: (r.name as string) ?? 'Unnamed Resource',
              description: (r.description as string | null) ?? null,
              resource_type: payload.resource_type,
              address_line1: (r.address_line1 as string | null) ?? null,
              city: (r.city as string | null) ?? null,
              state: (r.state as string | null) ?? null,
              zip_code: (r.zip_code as string | null) ?? null,
              phone: (r.phone as string | null) ?? null,
              website: (r.website as string | null) ?? null,
              latitude: (r.latitude as number | null) ?? null,
              longitude: (r.longitude as number | null) ?? null,
              hours_of_operation: (r.hours_of_operation ?? null) as unknown,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'source_instance_id,source_resource_id' }
          )

        if (upsertErr) {
          processError = `Database error: ${upsertErr.message}`
          actionTaken = 'logged'
        } else {
          actionTaken = 'upserted'
          processSuccess = true
        }
        break
      }

      case 'resource.deleted': {
        const { error: deleteErr } = await supabase
          .from('federated_resources')
          .delete()
          .eq('source_instance_id', instance.id)
          .eq('source_resource_id', payload.resource_id)

        if (deleteErr) {
          processError = `Database error: ${deleteErr.message}`
          actionTaken = 'logged'
        } else {
          actionTaken = 'deleted'
          processSuccess = true
        }
        break
      }
    }
  } catch (err) {
    processError = err instanceof Error ? err.message : 'Unknown error'
    actionTaken = 'logged'
  }

  // ---- 8. Insert federation_sync_log ----
  try {
    const { data: localInstance } = await supabase
      .from('federated_instances')
      .select('id')
      .eq('is_local', true)
      .single()

    if (localInstance) {
      const { data: peer } = await supabase
        .from('federation_peers')
        .select('id')
        .eq('local_instance_id', localInstance.id)
        .eq('remote_instance_id', instance.id)
        .single()

      if (peer) {
        await supabase.from('federation_sync_log').insert({
          peer_id: peer.id,
          sync_status: processSuccess ? 'completed' : 'failed',
          started_at: payload.timestamp,
          completed_at: new Date().toISOString(),
          resources_fetched: actionTaken === 'upserted' ? 1 : 0,
          resources_created: payload.event === 'resource.created' && actionTaken === 'upserted' ? 1 : 0,
          resources_updated: payload.event === 'resource.updated' && actionTaken === 'upserted' ? 1 : 0,
          resources_deleted: actionTaken === 'deleted' ? 1 : 0,
          error_message: processError ?? null,
          sync_duration_ms: Date.now() - new Date(payload.timestamp).getTime(),
        })
      }
    }
  } catch {
    // Logging failure must never surface as an error to the caller.
  }

  // ---- 9. Return ----
  if (!processSuccess && actionTaken === 'logged' && processError) {
    return jsonResponse({ error: 'Failed to process webhook', details: processError }, 500)
  }

  return jsonResponse({
    received: true,
    event: payload.event,
    resource_id: payload.resource_id,
    action_taken: actionTaken,
  })
})
