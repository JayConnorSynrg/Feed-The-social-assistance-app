import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
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

interface FederationPeer {
  id: string
  remote_instance_id: string
  local_instance_id: string
  trust_score: number
  trust_level: string
  federation_enabled: boolean
  auto_sync_enabled: boolean
  sync_interval_minutes: number
  updated_at: string
}

interface FederatedInstance {
  id: string
  instance_url: string
  instance_name: string
  status: string
  public_key: string
}

interface RemoteResource {
  id: string
  name: string
  description?: string
  resource_type: string
  address_line1?: string
  city?: string
  state?: string
  zip_code?: string
  latitude?: number
  longitude?: number
  phone?: string
  website?: string
  hours_of_operation?: unknown
  metadata?: unknown
  updated_at: string
}

interface RemoteResourcesResponse {
  resources: RemoteResource[]
  cursor?: string
  has_more: boolean
}

interface SyncResult {
  peer_id: string
  peer_name: string
  status: 'success' | 'error'
  resources_fetched: number
  resources_created: number
  resources_updated: number
  error_message?: string
  duration_ms: number
}

/**
 * Sign a request using the local instance's private key
 */
async function signRequest(
  method: string,
  path: string,
  body: string | null,
  privateKeyPem: string
): Promise<string> {
  // Create canonical request string
  const timestamp = new Date().toISOString()
  const bodyHash = body
    ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
    : new ArrayBuffer(0)
  const bodyHashHex = Array.from(new Uint8Array(bodyHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const canonicalString = `${method}\n${path}\n${timestamp}\n${bodyHashHex}`

  // Import private key
  const pemContent = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binaryDer = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0))

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  )

  // Sign the canonical string
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(canonicalString)
  )

  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return `${timestamp}:${signatureHex}`
}

/**
 * Fetch resources from a remote instance
 */
async function fetchRemoteResources(
  instanceUrl: string,
  sinceTimestamp: string | null,
  privateKeyPem: string,
  timeoutMs: number = 30000
): Promise<RemoteResource[]> {
  const allResources: RemoteResource[] = []
  let cursor: string | undefined
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams()
    if (sinceTimestamp) {
      params.set('since', sinceTimestamp)
    }
    if (cursor) {
      params.set('cursor', cursor)
    }

    const path = `/api/federation/resources?${params.toString()}`
    const url = `${instanceUrl}${path}`

    const signature = await signRequest('GET', path, null, privateKeyPem)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Federation-Signature': signature,
        },
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: RemoteResourcesResponse = await response.json()
      allResources.push(...data.resources)

      cursor = data.cursor
      hasMore = data.has_more
    } catch (error) {
      clearTimeout(timeout)
      throw error
    }
  }

  return allResources
}

/**
 * Sync resources from a single peer
 */
async function syncPeer(
  peer: FederationPeer,
  remoteInstance: FederatedInstance,
  supabase: ReturnType<typeof createClient>,
  privateKeyPem: string
): Promise<SyncResult> {
  const startTime = Date.now()
  const syncLogId = crypto.randomUUID()

  // Insert initial sync log entry
  await supabase.from('federation_sync_log').insert({
    id: syncLogId,
    peer_id: peer.id,
    sync_status: 'in_progress',
    started_at: new Date().toISOString(),
  })

  try {
    // Get the last sync timestamp for this peer
    const { data: lastSync } = await supabase
      .from('federation_sync_log')
      .select('completed_at')
      .eq('peer_id', peer.id)
      .eq('sync_status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    const sinceTimestamp = lastSync?.completed_at || null

    // Fetch remote resources
    const remoteResources = await fetchRemoteResources(
      remoteInstance.instance_url,
      sinceTimestamp,
      privateKeyPem,
      30000
    )

    let resourcesCreated = 0
    let resourcesUpdated = 0

    // Process each resource
    for (const resource of remoteResources) {
      // Check if resource already exists
      const { data: existing } = await supabase
        .from('federated_resources')
        .select('id, updated_at')
        .eq('source_resource_id', resource.id)
        .eq('source_instance_id', remoteInstance.id)
        .single()

      const resourceData = {
        source_instance_id: remoteInstance.id,
        source_resource_id: resource.id,
        name: resource.name,
        description: resource.description || null,
        resource_type: resource.resource_type,
        address_line1: resource.address_line1 || null,
        city: resource.city || null,
        state: resource.state || null,
        zip_code: resource.zip_code || null,
        latitude: resource.latitude || null,
        longitude: resource.longitude || null,
        phone: resource.phone || null,
        website: resource.website || null,
        hours_of_operation: resource.hours_of_operation || null,
        metadata: resource.metadata || null,
        trust_score: peer.trust_score,
        last_synced_at: new Date().toISOString(),
      }

      if (existing) {
        // Update existing resource
        await supabase
          .from('federated_resources')
          .update(resourceData)
          .eq('id', existing.id)
        resourcesUpdated++
      } else {
        // Insert new resource
        await supabase
          .from('federated_resources')
          .insert(resourceData)
        resourcesCreated++
      }
    }

    const duration = Date.now() - startTime

    // Update sync log with success
    await supabase
      .from('federation_sync_log')
      .update({
        sync_status: 'success',
        completed_at: new Date().toISOString(),
        resources_fetched: remoteResources.length,
        resources_created: resourcesCreated,
        resources_updated: resourcesUpdated,
        sync_duration_ms: duration,
      })
      .eq('id', syncLogId)

    // Update peer's updated_at timestamp
    await supabase
      .from('federation_peers')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', peer.id)

    return {
      peer_id: peer.id,
      peer_name: remoteInstance.instance_name,
      status: 'success',
      resources_fetched: remoteResources.length,
      resources_created: resourcesCreated,
      resources_updated: resourcesUpdated,
      duration_ms: duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Update sync log with error
    await supabase
      .from('federation_sync_log')
      .update({
        sync_status: 'error',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        sync_duration_ms: duration,
      })
      .eq('id', syncLogId)

    return {
      peer_id: peer.id,
      peer_name: remoteInstance.instance_name,
      status: 'error',
      resources_fetched: 0,
      resources_created: 0,
      resources_updated: 0,
      error_message: errorMessage,
      duration_ms: duration,
    }
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const privateKeyPem = Deno.env.get('FEDERATION_PRIVATE_KEY')!

    if (!privateKeyPem) {
      throw new Error('FEDERATION_PRIVATE_KEY environment variable not set')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all enabled peers with auto-sync enabled
    const { data: peers, error: peersError } = await supabase
      .from('federation_peers')
      .select('*')
      .eq('federation_enabled', true)
      .eq('auto_sync_enabled', true)

    if (peersError) {
      throw peersError
    }

    if (!peers || peers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No peers configured for auto-sync',
          results: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Fetch remote instance details for all peers
    const remoteInstanceIds = peers.map(p => p.remote_instance_id)
    const { data: instances, error: instancesError } = await supabase
      .from('federated_instances')
      .select('*')
      .in('id', remoteInstanceIds)

    if (instancesError) {
      throw instancesError
    }

    const instancesMap = new Map(instances?.map(i => [i.id, i]) || [])

    // Sync each peer
    const results: SyncResult[] = []
    for (const peer of peers) {
      const remoteInstance = instancesMap.get(peer.remote_instance_id)
      if (!remoteInstance) {
        results.push({
          peer_id: peer.id,
          peer_name: 'Unknown',
          status: 'error',
          resources_fetched: 0,
          resources_created: 0,
          resources_updated: 0,
          error_message: 'Remote instance not found',
          duration_ms: 0,
        })
        continue
      }

      const result = await syncPeer(peer, remoteInstance, supabase, privateKeyPem)
      results.push(result)
    }

    // Calculate summary statistics
    const totalFetched = results.reduce((sum, r) => sum + r.resources_fetched, 0)
    const totalCreated = results.reduce((sum, r) => sum + r.resources_created, 0)
    const totalUpdated = results.reduce((sum, r) => sum + r.resources_updated, 0)
    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          peers_synced: peers.length,
          peers_success: successCount,
          peers_error: errorCount,
          total_resources_fetched: totalFetched,
          total_resources_created: totalCreated,
          total_resources_updated: totalUpdated,
        },
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Federation sync error:', error)
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
