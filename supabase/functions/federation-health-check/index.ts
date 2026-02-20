/**
 * Federation Health Check Scheduler
 *
 * Edge Function that runs on a schedule to health check all federation partners.
 * Records response times and status, and adjusts trust scores based on results.
 *
 * Schedule: Every 5 minutes via pg_cron or Supabase cron
 *
 * To deploy:
 *   npx supabase functions deploy federation-health-check
 *
 * To schedule via SQL:
 *   SELECT cron.schedule(
 *     'federation-health-check',
 *     '*/5 * * * *',
 *     $$SELECT net.http_post(
 *       url:='https://YOUR_PROJECT.supabase.co/functions/v1/federation-health-check',
 *       headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
 *     );$$
 *   );
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface FederationPeer {
  id: string
  remote_instance_id: string
  federation_enabled: boolean
  trust_score: number
  remote_instance: {
    id: string
    instance_url: string
    instance_name: string
    status: string
  }
}

interface HealthCheckResult {
  peer_id: string
  instance_id: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  response_time_ms: number
  error_message?: string
}

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

// Thresholds
const DEGRADED_THRESHOLD_MS = 3000 // 3 seconds
const TIMEOUT_MS = 10000 // 10 seconds

// Trust score adjustments
const HEALTHY_BOOST = 0.001
const DEGRADED_PENALTY = -0.002
const UNHEALTHY_PENALTY = -0.01
const MAX_TRUST_CHANGE_PER_CHECK = 0.02

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get local instance
    const { data: localInstance, error: localError } = await supabase
      .from('federated_instances')
      .select('id')
      .eq('is_local', true)
      .single()

    if (localError || !localInstance) {
      throw new Error('Local instance not registered')
    }

    // Fetch all active federation peers
    const { data: peers, error: peersError } = await supabase
      .from('federation_peers')
      .select(`
        id,
        remote_instance_id,
        federation_enabled,
        trust_score,
        remote_instance:federated_instances!federation_peers_remote_instance_id_fkey(
          id,
          instance_url,
          instance_name,
          status
        )
      `)
      .eq('local_instance_id', localInstance.id)
      .eq('federation_enabled', true)

    if (peersError) {
      throw peersError
    }

    const results: HealthCheckResult[] = []

    // Health check each peer in parallel
    const checkPromises = (peers || []).map(async (peer: FederationPeer) => {
      if (!peer.remote_instance || peer.remote_instance.status === 'blocked') {
        return null
      }

      const result = await performHealthCheck(peer)
      results.push(result)

      // Record health check
      await supabase.from('federation_health_checks').insert({
        instance_id: peer.remote_instance_id,
        status: result.status,
        response_time_ms: result.response_time_ms,
        error_message: result.error_message,
        checked_by: localInstance.id,
      })

      // Update trust score based on result
      const trustAdjustment = calculateTrustAdjustment(result.status)
      const newTrustScore = Math.max(
        0,
        Math.min(1, peer.trust_score + trustAdjustment)
      )

      // Update peer trust score
      await supabase
        .from('federation_peers')
        .update({ trust_score: newTrustScore })
        .eq('id', peer.id)

      // Log trust event if score changed significantly
      if (Math.abs(trustAdjustment) >= 0.001) {
        await supabase.from('federation_trust_events').insert({
          peer_id: peer.id,
          event_type: result.status === 'healthy' ? 'health_check_success' : 'health_check_failure',
          old_score: peer.trust_score,
          new_score: newTrustScore,
          reason: `Health check ${result.status}: ${result.response_time_ms}ms`,
          metadata: {
            status: result.status,
            response_time_ms: result.response_time_ms,
            error_message: result.error_message,
          },
          created_by: 'system',
        })
      }

      // Update instance last_seen_at if healthy
      if (result.status === 'healthy') {
        await supabase
          .from('federated_instances')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', peer.remote_instance_id)
      }

      return result
    })

    await Promise.allSettled(checkPromises)

    // Summary
    const summary = {
      timestamp: new Date().toISOString(),
      total_checked: results.length,
      healthy: results.filter((r) => r.status === 'healthy').length,
      degraded: results.filter((r) => r.status === 'degraded').length,
      unhealthy: results.filter((r) => r.status === 'unhealthy').length,
      results,
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Health check error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

/**
 * Perform a health check on a single peer
 */
async function performHealthCheck(peer: FederationPeer): Promise<HealthCheckResult> {
  const instanceUrl = peer.remote_instance.instance_url
  const healthEndpoint = `${instanceUrl}/.well-known/feed-instance`

  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(healthEndpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FEED-Federation-HealthCheck/1.0',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseTime = Date.now() - startTime

    if (!response.ok) {
      return {
        peer_id: peer.id,
        instance_id: peer.remote_instance_id,
        status: 'unhealthy',
        response_time_ms: responseTime,
        error_message: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    // Check response time for degraded status
    if (responseTime > DEGRADED_THRESHOLD_MS) {
      return {
        peer_id: peer.id,
        instance_id: peer.remote_instance_id,
        status: 'degraded',
        response_time_ms: responseTime,
      }
    }

    return {
      peer_id: peer.id,
      instance_id: peer.remote_instance_id,
      status: 'healthy',
      response_time_ms: responseTime,
    }
  } catch (error) {
    const responseTime = Date.now() - startTime

    return {
      peer_id: peer.id,
      instance_id: peer.remote_instance_id,
      status: 'unhealthy',
      response_time_ms: responseTime,
      error_message: error.name === 'AbortError' ? 'Request timeout' : error.message,
    }
  }
}

/**
 * Calculate trust score adjustment based on health check result
 */
function calculateTrustAdjustment(status: 'healthy' | 'degraded' | 'unhealthy'): number {
  switch (status) {
    case 'healthy':
      return HEALTHY_BOOST
    case 'degraded':
      return DEGRADED_PENALTY
    case 'unhealthy':
      return UNHEALTHY_PENALTY
    default:
      return 0
  }
}
