/**
 * Federation Webhook Receiver API
 *
 * Receives webhook notifications from federation partners when their resources change.
 * Verifies HMAC signature, validates payload, and triggers targeted sync for the updated resource.
 *
 * POST /api/federation/webhook
 *
 * Headers:
 * - X-Federation-Signature: sha256={hex_digest} - HMAC-SHA256 of the request body
 * - X-Federation-Event: event type (e.g., resource.created, resource.updated, resource.deleted)
 * - Content-Type: application/json
 * - User-Agent: FEED-Federation/1.0
 *
 * Payload:
 * {
 *   "event": "resource.created" | "resource.updated" | "resource.deleted",
 *   "instance_id": "uuid",
 *   "instance_url": "https://oakland.feed.org",
 *   "resource_id": "uuid",
 *   "resource_type": "food",
 *   "timestamp": "2026-02-14T12:00:00Z",
 *   "signature": "sha256=..."
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@feed/database'
import { createHmac, timingSafeEqual } from 'crypto'

// Valid webhook event types
const VALID_EVENTS = ['resource.created', 'resource.updated', 'resource.deleted'] as const
type WebhookEvent = typeof VALID_EVENTS[number]

// Maximum age for webhook timestamp (5 minutes)
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000

interface WebhookPayload {
  event: WebhookEvent
  instance_id: string
  instance_url: string
  resource_id: string
  resource_type: string
  timestamp: string
  signature: string
}

interface WebhookResponse {
  received: true
  event: WebhookEvent
  resource_id: string
  action_taken: 'upserted' | 'deleted' | 'logged'
}

/**
 * Verify HMAC signature of webhook payload
 */
function verifyWebhookSignature(
  body: string,
  signatureHeader: string,
  secret: string
): boolean {
  try {
    // Compute expected signature
    const expectedSignature = createHmac('sha256', secret)
      .update(body)
      .digest('hex')

    // Extract received signature (remove "sha256=" prefix if present)
    const receivedSignature = signatureHeader.replace(/^sha256=/, '')

    // Timing-safe comparison to prevent timing attacks
    return timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    )
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * Validate webhook payload structure and contents
 */
function validatePayload(payload: unknown): {
  valid: boolean
  error?: string
  data?: WebhookPayload
} {
  // Check if payload is an object
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be a JSON object' }
  }

  const p = payload as Record<string, unknown>

  // Validate required fields
  const requiredFields = [
    'event',
    'instance_id',
    'instance_url',
    'resource_id',
    'resource_type',
    'timestamp',
    'signature',
  ]

  for (const field of requiredFields) {
    if (!p[field] || typeof p[field] !== 'string') {
      return { valid: false, error: `Missing or invalid field: ${field}` }
    }
  }

  // Validate event type
  if (!VALID_EVENTS.includes(p.event as WebhookEvent)) {
    return {
      valid: false,
      error: `Invalid event type. Must be one of: ${VALID_EVENTS.join(', ')}`,
    }
  }

  // Validate timestamp (must be within 5 minutes)
  const timestamp = new Date(p.timestamp as string)
  if (isNaN(timestamp.getTime())) {
    return { valid: false, error: 'Invalid timestamp format' }
  }

  const now = new Date()
  const age = now.getTime() - timestamp.getTime()

  if (age > MAX_TIMESTAMP_AGE_MS) {
    return {
      valid: false,
      error: `Timestamp too old (max age: ${MAX_TIMESTAMP_AGE_MS / 1000}s)`,
    }
  }

  // Timestamp cannot be in the future (allow 1 minute clock skew)
  if (age < -60000) {
    return { valid: false, error: 'Timestamp is in the future' }
  }

  // Validate UUID format for IDs
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(p.instance_id as string)) {
    return { valid: false, error: 'Invalid instance_id format (must be UUID)' }
  }
  if (!uuidRegex.test(p.resource_id as string)) {
    return { valid: false, error: 'Invalid resource_id format (must be UUID)' }
  }

  // Validate URL format
  try {
    new URL(p.instance_url as string)
  } catch {
    return { valid: false, error: 'Invalid instance_url format' }
  }

  return {
    valid: true,
    data: p as unknown as WebhookPayload,
  }
}

/**
 * Fetch a specific resource from a federation partner
 */
async function fetchResourceFromPartner(
  instanceUrl: string,
  resourceId: string,
  publicKey: string,
  privateKey: string
): Promise<{
  success: boolean
  resource?: Record<string, unknown>
  error?: string
}> {
  try {
    // Import signature utilities
    const { signRequest } = await import('@feed/shared/lib/http-signatures')

    const url = `${instanceUrl}/api/federation/resources/${resourceId}`

    // Create signature for the request
    const keyId = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}#main-key`
    const signatureHeader = signRequest(privateKey, keyId, {
      method: 'GET',
      path: new URL(url).pathname,
      headers: {
        host: new URL(url).host,
        date: new Date().toUTCString(),
      },
    })

    // Fetch the resource
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Signature: signatureHeader,
        Date: new Date().toUTCString(),
        Accept: 'application/json',
        'User-Agent': 'FEED-Federation/1.0',
      },
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch resource: ${response.status} ${response.statusText}`,
      }
    }

    const resource = await response.json()
    return { success: true, resource }
  } catch (error) {
    console.error('Error fetching resource from partner:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process webhook event
 */
async function processWebhookEvent(
  payload: WebhookPayload,
  instance: {
    id: string
    instance_url: string
    public_key: string
  }
): Promise<{
  success: boolean
  action: 'upserted' | 'deleted' | 'logged'
  error?: string
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

  try {
    switch (payload.event) {
      case 'resource.created':
      case 'resource.updated': {
        // Fetch the resource from the partner instance
        const privateKey = process.env.FEDERATION_PRIVATE_KEY!
        const result = await fetchResourceFromPartner(
          instance.instance_url,
          payload.resource_id,
          instance.public_key,
          privateKey
        )

        if (!result.success || !result.resource) {
          console.error('Failed to fetch resource:', result.error)
          return {
            success: false,
            action: 'logged',
            error: result.error || 'Failed to fetch resource',
          }
        }

        const resource = result.resource

        // Upsert into federated_resources
        const { error: upsertError } = await supabase
          .from('federated_resources')
          .upsert(
            {
              source_instance_id: instance.id,
              source_resource_id: payload.resource_id,
              name: (resource.name as string) || 'Unnamed Resource',
              description: (resource.description as string | null) || null,
              resource_type: payload.resource_type,
              address_line1: (resource.address_line1 as string | null) || null,
              city: (resource.city as string | null) || null,
              state: (resource.state as string | null) || null,
              zip_code: (resource.zip_code as string | null) || null,
              phone: (resource.phone as string | null) || null,
              website: (resource.website as string | null) || null,
              latitude: (resource.latitude as number | null) || null,
              longitude: (resource.longitude as number | null) || null,
              hours_of_operation: (resource.hours_of_operation as Database['public']['Tables']['federated_resources']['Row']['hours_of_operation']) || null,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'source_instance_id,source_resource_id',
            }
          )

        if (upsertError) {
          console.error('Failed to upsert resource:', upsertError)
          return {
            success: false,
            action: 'logged',
            error: `Database error: ${upsertError.message}`,
          }
        }

        return { success: true, action: 'upserted' }
      }

      case 'resource.deleted': {
        // Delete from federated_resources (hard delete)
        const { error: deleteError } = await supabase
          .from('federated_resources')
          .delete()
          .eq('source_instance_id', instance.id)
          .eq('source_resource_id', payload.resource_id)

        if (deleteError) {
          console.error('Failed to delete resource:', deleteError)
          return {
            success: false,
            action: 'logged',
            error: `Database error: ${deleteError.message}`,
          }
        }

        return { success: true, action: 'deleted' }
      }

      default: {
        return {
          success: false,
          action: 'logged',
          error: `Unknown event type: ${payload.event}`,
        }
      }
    }
  } catch (error) {
    console.error('Error processing webhook event:', error)
    return {
      success: false,
      action: 'logged',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Log webhook receipt to federation_sync_log
 */
async function logWebhook(
  instanceId: string,
  payload: WebhookPayload,
  success: boolean,
  action: 'upserted' | 'deleted' | 'logged',
  error?: string
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

  try {
    // Get the local instance ID
    const { data: localInstance } = await supabase
      .from('federated_instances')
      .select('id')
      .eq('is_local', true)
      .single()

    if (!localInstance) {
      console.error('Failed to find local instance for logging')
      return
    }

    // Get the federation peer relationship
    const { data: peer } = await supabase
      .from('federation_peers')
      .select('id')
      .eq('local_instance_id', localInstance.id)
      .eq('remote_instance_id', instanceId)
      .single()

    if (!peer) {
      console.error('Failed to find federation peer for logging')
      return
    }

    // Insert log entry
    await supabase.from('federation_sync_log').insert({
      peer_id: peer.id,
      sync_status: success ? 'completed' : 'failed',
      started_at: payload.timestamp,
      completed_at: new Date().toISOString(),
      resources_fetched: action === 'upserted' ? 1 : 0,
      resources_created: payload.event === 'resource.created' && action === 'upserted' ? 1 : 0,
      resources_updated: payload.event === 'resource.updated' && action === 'upserted' ? 1 : 0,
      resources_deleted: action === 'deleted' ? 1 : 0,
      error_message: error || null,
      sync_duration_ms: Date.now() - new Date(payload.timestamp).getTime(),
    })
  } catch (logError) {
    console.error('Failed to log webhook:', logError)
  }
}

/**
 * POST handler - receive webhook notifications
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const privateKey = process.env.FEDERATION_PRIVATE_KEY

    if (!supabaseUrl || !supabaseServiceKey || !privateKey) {
      console.error('Missing required environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Read request body
    const bodyText = await request.text()
    let payload: unknown

    try {
      payload = JSON.parse(bodyText)
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Validate payload structure
    const validation = validatePayload(payload)
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: validation.error || 'Invalid payload' },
        { status: 400 }
      )
    }

    const webhookPayload = validation.data

    // Get signature header
    const signatureHeader = request.headers.get('X-Federation-Signature')
    if (!signatureHeader) {
      return NextResponse.json(
        { error: 'Missing X-Federation-Signature header' },
        { status: 401 }
      )
    }

    // Derive shared secret from first 64 characters of private key
    const sharedSecret = privateKey.substring(0, 64)

    // Verify signature
    if (!verifyWebhookSignature(bodyText, signatureHeader, sharedSecret)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Look up the instance
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)
    const { data: instance, error: instanceError } = await supabase
      .from('federated_instances')
      .select('id, instance_url, instance_name, public_key, status')
      .eq('id', webhookPayload.instance_id)
      .single()

    if (instanceError || !instance) {
      return NextResponse.json(
        {
          error: `Unknown instance: ${webhookPayload.instance_id}`,
          details: instanceError?.message,
        },
        { status: 404 }
      )
    }

    // Verify instance is active
    if (instance.status !== 'active') {
      return NextResponse.json(
        { error: `Instance is not active (status: ${instance.status})` },
        { status: 403 }
      )
    }

    // Verify instance URL matches
    if (instance.instance_url !== webhookPayload.instance_url) {
      return NextResponse.json(
        {
          error: 'Instance URL mismatch',
          expected: instance.instance_url,
          received: webhookPayload.instance_url,
        },
        { status: 400 }
      )
    }

    // Process the webhook event
    const result = await processWebhookEvent(webhookPayload, instance)

    // Log the webhook receipt
    await logWebhook(
      instance.id,
      webhookPayload,
      result.success,
      result.action,
      result.error
    )

    // Return response
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to process webhook',
          details: result.error,
        },
        { status: 500 }
      )
    }

    const response: WebhookResponse = {
      received: true,
      event: webhookPayload.event,
      resource_id: webhookPayload.resource_id,
      action_taken: result.action,
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS handler - CORS preflight
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, X-Federation-Signature, X-Federation-Event, User-Agent',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  })
}
