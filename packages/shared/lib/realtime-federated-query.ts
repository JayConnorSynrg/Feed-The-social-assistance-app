/**
 * Real-Time Federated Query Module
 *
 * Queries trusted federation partners in real-time when local cache is stale.
 * Used for resource discovery across the FEED federation network.
 */

export interface RealtimeQueryOptions {
  query: string
  category?: string
  location?: { lat: number; lng: number; radius_miles: number }
  maxResults?: number
  timeoutMs?: number  // default 2000
  minTrustLevel?: string // default 'trusted'
}

export interface PartnerEndpoint {
  instanceId: string
  instanceName: string
  instanceUrl: string
  trustScore: number
  trustLevel: string
  lastSyncedAt: string
  publicKey: string
}

export interface RealtimeQueryResult {
  partnerId: string
  partnerName: string
  status: 'success' | 'timeout' | 'error'
  resources: RealtimeRemoteResource[]
  queryTimeMs: number
  errorMessage?: string
}

export interface RealtimeRemoteResource {
  id: string
  name: string
  description?: string
  resource_type: string
  address_line1?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  latitude?: number
  longitude?: number
  updated_at: string
}

export interface RealtimeSearchResponse {
  results: RealtimeQueryResult[]
  totalResources: number
  partnersQueried: number
  partnersSucceeded: number
  totalQueryTimeMs: number
}

// Trust level hierarchy mapping
const TRUST_LEVELS: Record<string, number> = {
  untrusted: 0,
  pending: 1,
  trusted: 2,
  verified: 3,
  core: 4,
}

const DEFAULT_TIMEOUT_MS = 2000
const DEFAULT_MAX_CACHE_AGE_MS = 3600000 // 1 hour
const DEFAULT_MIN_TRUST_LEVEL = 'trusted'

/**
 * Query multiple federation partners in real-time for resource data
 */
export async function queryPartnersRealtime(
  partners: PartnerEndpoint[],
  options: RealtimeQueryOptions
): Promise<RealtimeSearchResponse> {
  const startTime = Date.now()
  const minTrustLevel = options.minTrustLevel || DEFAULT_MIN_TRUST_LEVEL

  // Filter partners by trust level and cache staleness
  const eligiblePartners = partners.filter(partner => {
    const meetsMinTrust = isPartnerEligible(partner, minTrustLevel)
    const hasStaleCache = isCacheStale(partner.lastSyncedAt)
    return meetsMinTrust && hasStaleCache
  })

  if (eligiblePartners.length === 0) {
    return {
      results: [],
      totalResources: 0,
      partnersQueried: 0,
      partnersSucceeded: 0,
      totalQueryTimeMs: Date.now() - startTime,
    }
  }

  // Query all eligible partners in parallel
  const queryPromises = eligiblePartners.map(partner =>
    queryPartner(partner, options)
  )

  const settledResults = await Promise.allSettled(queryPromises)

  // Process results
  const results: RealtimeQueryResult[] = settledResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      // Handle rejected promise
      const partner = eligiblePartners[index]
      return {
        partnerId: partner.instanceId,
        partnerName: partner.instanceName,
        status: 'error' as const,
        resources: [],
        queryTimeMs: 0,
        errorMessage: result.reason?.message || 'Unknown error',
      }
    }
  })

  // Aggregate statistics
  const totalResources = results.reduce((sum, r) => sum + r.resources.length, 0)
  const partnersSucceeded = results.filter(r => r.status === 'success').length

  return {
    results,
    totalResources,
    partnersQueried: eligiblePartners.length,
    partnersSucceeded,
    totalQueryTimeMs: Date.now() - startTime,
  }
}

/**
 * Check if a partner meets the minimum trust level requirement
 */
export function isPartnerEligible(
  partner: PartnerEndpoint,
  minTrustLevel: string
): boolean {
  const partnerLevel = TRUST_LEVELS[partner.trustLevel.toLowerCase()] ?? -1
  const requiredLevel = TRUST_LEVELS[minTrustLevel.toLowerCase()] ?? 0

  return partnerLevel >= requiredLevel
}

/**
 * Check if partner cache is stale based on last sync time
 */
export function isCacheStale(
  lastSyncedAt: string,
  maxAgeMs: number = DEFAULT_MAX_CACHE_AGE_MS
): boolean {
  try {
    const lastSyncTime = new Date(lastSyncedAt).getTime()
    const now = Date.now()
    const age = now - lastSyncTime

    return age > maxAgeMs
  } catch (error) {
    // If date parsing fails, consider cache stale
    return true
  }
}

/**
 * Query a single federation partner's resource endpoint
 */
export async function queryPartner(
  partner: PartnerEndpoint,
  options: RealtimeQueryOptions
): Promise<RealtimeQueryResult> {
  const startTime = Date.now()
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS

  // Create AbortController for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    // Build query parameters
    const params = new URLSearchParams()
    params.set('query', options.query)

    if (options.category) {
      params.set('category', options.category)
    }

    if (options.location) {
      params.set('lat', options.location.lat.toString())
      params.set('lng', options.location.lng.toString())
      params.set('radius_miles', options.location.radius_miles.toString())
    }

    if (options.maxResults) {
      params.set('limit', options.maxResults.toString())
    }

    // Construct endpoint URL
    const baseUrl = partner.instanceUrl.replace(/\/$/, '') // Remove trailing slash
    const endpoint = `${baseUrl}/api/federation/resources?${params.toString()}`

    // Make request
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FEED-Federation/1.0',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        partnerId: partner.instanceId,
        partnerName: partner.instanceName,
        status: 'error',
        resources: [],
        queryTimeMs: Date.now() - startTime,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()
    const resources = Array.isArray(data.resources) ? data.resources : []

    return {
      partnerId: partner.instanceId,
      partnerName: partner.instanceName,
      status: 'success',
      resources,
      queryTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    clearTimeout(timeoutId)

    // Check if error was due to timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        partnerId: partner.instanceId,
        partnerName: partner.instanceName,
        status: 'timeout',
        resources: [],
        queryTimeMs: timeoutMs,
        errorMessage: `Request timed out after ${timeoutMs}ms`,
      }
    }

    // Other errors
    return {
      partnerId: partner.instanceId,
      partnerName: partner.instanceName,
      status: 'error',
      resources: [],
      queryTimeMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
