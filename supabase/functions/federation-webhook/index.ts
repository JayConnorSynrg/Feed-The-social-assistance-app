/**
 * Federation Webhook Notifications
 *
 * Notifies federation partners of resource changes via webhook POST requests
 * with HMAC-signed payloads.
 *
 * Trigger: HTTP POST with event payload
 * Auth: Service role key required
 *
 * Environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - FEDERATION_PRIVATE_KEY (for signing)
 * - FEDERATION_INSTANCE_URL (this instance's URL)
 * - FEDERATION_INSTANCE_ID (this instance's UUID)
 *
 * To deploy:
 *   npx supabase functions deploy federation-webhook
 *
 * To test locally:
 *   curl -X POST http://localhost:54321/functions/v1/federation-webhook \
 *     -H "Authorization: Bearer SERVICE_ROLE_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{"event_type":"insert","resource_id":"uuid","resource_type":"food"}'
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS configuration - restrict to app domains
const ALLOWED_ORIGINS = [
  Deno.env.get('APP_URL') || 'http://localhost:3000',
  'capacitor://localhost',  // Mobile app (iOS)
  'http://localhost',       // Mobile app (Android webview)
  'ionic://localhost',      // Ionic dev
]

// Get CORS headers with validated origin
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] // Default to APP_URL

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  }
}

// Event type mapping
const EVENT_TYPE_MAP: Record<string, string> = {
  insert: 'resource.created',
  update: 'resource.updated',
  delete: 'resource.deleted',
}

// Webhook delivery timeout
const WEBHOOK_TIMEOUT_MS = 10000

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAYS_MS = [1000, 4000, 16000] // Exponential backoff: 1s, 4s, 16s

interface WebhookPayload {
  event: string
  instance_id: string
  instance_url: string
  resource_id: string
  resource_type: string
  timestamp: string
  signature: string
}

interface WebhookRequestBody {
  event_type: 'insert' | 'update' | 'delete'
  resource_id: string
  resource_type: string
}

interface FederationPeer {
  id: string
  remote_instance_id: string
  federation_enabled: boolean
  metadata: {
    webhook_url?: string
    [key: string]: unknown
  }
  remote_instance: {
    id: string
    instance_url: string
    instance_name: string
  }
}

interface DeliveryResult {
  peer: string
  status: number
  attempts: number
  success: boolean
  error?: string
}

interface DeliverySummary {
  total: number
  succeeded: number
  failed: number
  retried: number
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
async function generateSignature(
  payload: string,
  signingSecret: string
): Promise<string> {
  const encoder = new TextEncoder()

  // Import secret key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Sign the payload
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )

  // Convert to hex string
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return `sha256=${signatureHex}`
}

/**
 * Deliver webhook to a single peer with retry logic
 */
async function deliverWebhook(
  webhookUrl: string,
  payload: WebhookPayload,
  peerName: string
): Promise<DeliveryResult> {
  const payloadJson = JSON.stringify(payload)
  let lastError: string | undefined
  let attempts = 0

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    attempts = attempt + 1

    try {
      // Add delay for retries
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]))
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FEED-Federation/1.0',
          'X-Federation-Signature': payload.signature,
          'X-Federation-Event': payload.event,
        },
        body: payloadJson,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.ok) {
        return {
          peer: peerName,
          status: response.status,
          attempts,
          success: true,
        }
      }

      lastError = `HTTP ${response.status}: ${response.statusText}`

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        break
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)

      // Don't retry on abort (timeout already exceeded)
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = 'Request timeout'
        break
      }
    }
  }

  return {
    peer: peerName,
    status: 0,
    attempts,
    success: false,
    error: lastError,
  }
}

/**
 * Log webhook delivery to database
 */
async function logDelivery(
  supabase: ReturnType<typeof createClient>,
  peerId: string,
  result: DeliveryResult,
  payload: WebhookPayload
): Promise<void> {
  await supabase.from('federation_sync_log').insert({
    peer_id: peerId,
    sync_status: result.success ? 'success' : 'failed',
    resources_fetched: 0,
    resources_created: 0,
    resources_updated: 0,
    resources_deleted: 0,
    error_message: result.error,
    sync_duration_ms: 0,
    started_at: payload.timestamp,
    completed_at: new Date().toISOString(),
  })
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405,
        }
      )
    }

    // Initialize environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const privateKey = Deno.env.get('FEDERATION_PRIVATE_KEY')
    const instanceUrl = Deno.env.get('FEDERATION_INSTANCE_URL') || 'http://localhost:3000'
    const instanceId = Deno.env.get('FEDERATION_INSTANCE_ID')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    if (!privateKey) {
      throw new Error('FEDERATION_PRIVATE_KEY not configured')
    }

    if (!instanceId) {
      throw new Error('FEDERATION_INSTANCE_ID not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const body: WebhookRequestBody = await req.json()
    const { event_type, resource_id, resource_type } = body

    if (!event_type || !resource_id || !resource_type) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: event_type, resource_id, resource_type',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Map event type
    const event = EVENT_TYPE_MAP[event_type]
    if (!event) {
      return new Response(
        JSON.stringify({
          error: `Invalid event_type: ${event_type}. Must be insert, update, or delete.`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Derive signing secret from first 64 chars of private key
    const signingSecret = privateKey.substring(0, 64)

    // Build webhook payload (without signature)
    const timestamp = new Date().toISOString()
    const payloadWithoutSignature = {
      event,
      instance_id: instanceId,
      instance_url: instanceUrl,
      resource_id,
      resource_type,
      timestamp,
    }

    // Generate signature
    const signature = await generateSignature(
      JSON.stringify(payloadWithoutSignature),
      signingSecret
    )

    // Complete payload with signature
    const webhookPayload: WebhookPayload = {
      ...payloadWithoutSignature,
      signature,
    }

    // Fetch all active peers with webhook URLs configured
    const { data: peers, error: peersError } = await supabase
      .from('federation_peers')
      .select(`
        id,
        remote_instance_id,
        federation_enabled,
        metadata,
        remote_instance:federated_instances!federation_peers_remote_instance_id_fkey(
          id,
          instance_url,
          instance_name
        )
      `)
      .eq('federation_enabled', true)

    if (peersError) {
      throw peersError
    }

    if (!peers || peers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          event,
          resource_id,
          deliveries: {
            total: 0,
            succeeded: 0,
            failed: 0,
            retried: 0,
          },
          details: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Filter peers with webhook_url configured
    const peersWithWebhooks = (peers as FederationPeer[]).filter(
      peer => peer.metadata?.webhook_url
    )

    if (peersWithWebhooks.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          event,
          resource_id,
          deliveries: {
            total: 0,
            succeeded: 0,
            failed: 0,
            retried: 0,
          },
          details: [],
          message: 'No peers with webhook_url configured',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Deliver webhooks in parallel
    const deliveryPromises = peersWithWebhooks.map(async (peer) => {
      const webhookUrl = peer.metadata.webhook_url as string
      const result = await deliverWebhook(
        webhookUrl,
        webhookPayload,
        peer.remote_instance.instance_name
      )

      // Log delivery result
      await logDelivery(supabase, peer.id, result, webhookPayload)

      return result
    })

    const deliveryResults = await Promise.allSettled(deliveryPromises)

    // Extract results and handle rejections
    const results: DeliveryResult[] = deliveryResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        // Promise rejected (shouldn't happen but handle it)
        return {
          peer: peersWithWebhooks[index].remote_instance.instance_name,
          status: 0,
          attempts: 1,
          success: false,
          error: result.reason?.message || 'Unknown error',
        }
      }
    })

    // Calculate summary
    const summary: DeliverySummary = {
      total: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      retried: results.filter(r => r.attempts > 1).length,
    }

    return new Response(
      JSON.stringify({
        success: true,
        event,
        resource_id,
        deliveries: summary,
        details: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Webhook delivery error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
