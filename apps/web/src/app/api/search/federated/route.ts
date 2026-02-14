/**
 * Federated Search API
 *
 * Searches across both local resources and cached federated resources from partner instances.
 * Returns a unified, ranked result set with source attribution.
 *
 * POST /api/search/federated
 * Request body:
 * {
 *   "query": "food bank",
 *   "category": "food",
 *   "location": { "lat": 37.8, "lng": -122.4, "radius_miles": 10 },
 *   "include_federated": true,
 *   "max_results": 50
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@feed/database'

type ResourceRow = Database['public']['Tables']['resources']['Row']
type FederatedResourceRow = Database['public']['Tables']['federated_resources']['Row']
type FederatedInstanceRow = Database['public']['Tables']['federated_instances']['Row']

interface SearchRequest {
  query: string
  category?: string
  location?: {
    lat: number
    lng: number
    radius_miles: number
  }
  include_federated?: boolean
  max_results?: number
}

interface UnifiedResource {
  id: string
  name: string
  description: string | null
  category: string
  address_line1: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  website: string | null
  hours_of_operation: Record<string, unknown> | null
  latitude: number | null
  longitude: number | null
  is_verified: boolean | null
  source: 'local' | 'federated'
  source_instance_name?: string
  source_instance_url?: string
  trust_score?: number | null
  distance_miles?: number
  relevance_score: number
}

interface SearchResponse {
  results: UnifiedResource[]
  meta: {
    total: number
    local_count: number
    federated_count: number
    query_time_ms: number
    partners_searched: number
  }
}

/**
 * Normalize string for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate Haversine distance between two points (in miles)
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959 // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calculate text relevance score (0-1)
 */
function calculateRelevance(
  query: string,
  name: string,
  description: string | null
): number {
  const normalizedQuery = normalizeString(query)
  const normalizedName = normalizeString(name)
  const normalizedDesc = description ? normalizeString(description) : ''

  // Exact name match
  if (normalizedName === normalizedQuery) {
    return 1.0
  }

  // Name contains query
  if (normalizedName.includes(normalizedQuery)) {
    return 0.8
  }

  // Query contains name (partial match)
  if (normalizedQuery.includes(normalizedName)) {
    return 0.7
  }

  // Description contains query
  if (normalizedDesc.includes(normalizedQuery)) {
    return 0.6
  }

  // Word-level matching
  const queryWords = normalizedQuery.split(' ')
  const nameWords = normalizedName.split(' ')
  const descWords = normalizedDesc.split(' ')

  const nameMatches = queryWords.filter((qw) => nameWords.some((nw) => nw.includes(qw)))
  const descMatches = queryWords.filter((qw) => descWords.some((dw) => dw.includes(qw)))

  const nameMatchRatio = nameMatches.length / queryWords.length
  const descMatchRatio = descMatches.length / queryWords.length

  return Math.max(nameMatchRatio * 0.5, descMatchRatio * 0.3, 0.1)
}

/**
 * Check if two resources are duplicates
 */
function isDuplicate(a: UnifiedResource, b: UnifiedResource): boolean {
  const normalizedA = normalizeString(a.name)
  const normalizedB = normalizeString(b.name)

  // Same normalized name and city
  if (
    normalizedA === normalizedB &&
    normalizeString(a.city || '') === normalizeString(b.city || '')
  ) {
    return true
  }

  // Very similar names (Levenshtein distance < 3) and same city
  const distance = levenshteinDistance(normalizedA, normalizedB)
  if (
    distance < 3 &&
    normalizeString(a.city || '') === normalizeString(b.city || '')
  ) {
    return true
  }

  return false
}

/**
 * Deduplicate results, preferring local resources and higher trust scores
 */
function deduplicateResults(results: UnifiedResource[]): UnifiedResource[] {
  const unique: UnifiedResource[] = []

  for (const result of results) {
    const duplicate = unique.find((u) => isDuplicate(u, result))

    if (!duplicate) {
      unique.push(result)
    } else {
      // Keep the better result
      // Prefer: local > higher trust score > higher relevance
      const keepCurrent =
        duplicate.source === 'local' ||
        (duplicate.source === result.source &&
          (duplicate.trust_score || 0) > (result.trust_score || 0)) ||
        (duplicate.source === result.source &&
          duplicate.trust_score === result.trust_score &&
          duplicate.relevance_score > result.relevance_score)

      if (!keepCurrent) {
        // Replace with better result
        const index = unique.indexOf(duplicate)
        unique[index] = result
      }
    }
  }

  return unique
}

/**
 * POST handler - execute federated search
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Parse request body
    const body: SearchRequest = await request.json()

    if (!body.query || typeof body.query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      )
    }

    const {
      query,
      category,
      location,
      include_federated = true,
      max_results = 50,
    } = body

    // Create Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

    // Search local resources
    let localResults: UnifiedResource[] = []

    if (location) {
      // Use nearby_resources RPC for location-based search
      const { data: nearbyData, error: nearbyError } = await supabase.rpc(
        'nearby_resources',
        {
          lat: location.lat,
          lng: location.lng,
          radius_miles: location.radius_miles,
        }
      )

      if (nearbyError) {
        console.error('Error fetching nearby resources:', nearbyError)
      } else if (nearbyData) {
        let filtered = nearbyData as ResourceRow[]

        // Apply category filter
        if (category) {
          filtered = filtered.filter((r) => r.category === category)
        }

        // Apply text search and calculate relevance
        localResults = filtered
          .map((row) => {
            const relevance = calculateRelevance(
              query,
              row.name,
              row.description
            )

            // Filter out very low relevance matches
            if (relevance < 0.1) return null

            return {
              id: row.id,
              name: row.name,
              description: row.description,
              category: row.category as string,
              address_line1: row.address_line1,
              city: row.city,
              state: row.state,
              zip_code: row.zip_code,
              phone: row.phone,
              website: row.website,
              hours_of_operation: row.hours_of_operation as Record<string, unknown> | null,
              latitude: null, // PostGIS geometry, would need extraction
              longitude: null,
              is_verified: row.is_verified,
              source: 'local' as const,
              relevance_score: relevance * 1.1, // Boost local results
            }
          })
          .filter(Boolean) as UnifiedResource[]
      }
    } else {
      // Text search without location
      let localQuery = supabase
        .from('resources')
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .eq('status', 'approved')
        .limit(max_results * 2) // Fetch extra for filtering

      if (category) {
        localQuery = localQuery.eq('category', category as never)
      }

      const { data: localData, error: localError } = await localQuery

      if (localError) {
        console.error('Error fetching local resources:', localError)
      } else if (localData) {
        localResults = (localData as ResourceRow[])
          .map((row) => {
            const relevance = calculateRelevance(
              query,
              row.name,
              row.description
            )

            if (relevance < 0.1) return null

            return {
              id: row.id,
              name: row.name,
              description: row.description,
              category: row.category as string,
              address_line1: row.address_line1,
              city: row.city,
              state: row.state,
              zip_code: row.zip_code,
              phone: row.phone,
              website: row.website,
              hours_of_operation: row.hours_of_operation as Record<string, unknown> | null,
              latitude: null,
              longitude: null,
              is_verified: row.is_verified,
              source: 'local' as const,
              relevance_score: relevance * 1.1, // Boost local results
            }
          })
          .filter(Boolean) as UnifiedResource[]
      }
    }

    // Search federated resources
    let federatedResults: UnifiedResource[] = []
    let partnersSearched = 0

    if (include_federated) {
      // Build federated query
      let federatedQuery = supabase
        .from('federated_resources')
        .select(`
          *,
          federated_instances!inner(
            instance_name,
            instance_url,
            status
          )
        `)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .eq('federated_instances.status', 'active')
        .limit(max_results * 2)

      if (category) {
        federatedQuery = federatedQuery.eq('resource_type', category)
      }

      const { data: federatedData, error: federatedError } =
        await federatedQuery

      if (federatedError) {
        console.error('Error fetching federated resources:', federatedError)
      } else if (federatedData) {
        const instanceSet = new Set<string>()

        federatedResults = (
          federatedData as Array<
            FederatedResourceRow & {
              federated_instances: FederatedInstanceRow
            }
          >
        )
          .map((row) => {
            instanceSet.add(row.source_instance_id)

            const relevance = calculateRelevance(
              query,
              row.name,
              row.description
            )

            if (relevance < 0.1) return null

            // Apply location filter if provided
            if (location && row.latitude && row.longitude) {
              const distance = haversineDistance(
                location.lat,
                location.lng,
                row.latitude,
                row.longitude
              )

              if (distance > location.radius_miles) {
                return null
              }

              return {
                id: row.id,
                name: row.name,
                description: row.description,
                category: row.resource_type,
                address_line1: row.address_line1,
                city: row.city,
                state: row.state,
                zip_code: row.zip_code,
                phone: row.phone,
                website: row.website,
                hours_of_operation: row.hours_of_operation as Record<string, unknown> | null,
                latitude: row.latitude,
                longitude: row.longitude,
                is_verified: row.is_verified,
                source: 'federated' as const,
                source_instance_name: row.federated_instances.instance_name,
                source_instance_url: row.federated_instances.instance_url,
                trust_score: row.trust_score,
                distance_miles: distance,
                relevance_score:
                  relevance * (1 + (row.trust_score || 0) * 0.1), // Boost by trust score
              }
            }

            return {
              id: row.id,
              name: row.name,
              description: row.description,
              category: row.resource_type,
              address_line1: row.address_line1,
              city: row.city,
              state: row.state,
              zip_code: row.zip_code,
              phone: row.phone,
              website: row.website,
              hours_of_operation: row.hours_of_operation as Record<string, unknown> | null,
              latitude: row.latitude,
              longitude: row.longitude,
              is_verified: row.is_verified,
              source: 'federated' as const,
              source_instance_name: row.federated_instances.instance_name,
              source_instance_url: row.federated_instances.instance_url,
              trust_score: row.trust_score,
              relevance_score: relevance * (1 + (row.trust_score || 0) * 0.1),
            }
          })
          .filter(Boolean) as UnifiedResource[]

        partnersSearched = instanceSet.size
      }
    }

    // Merge and rank results
    const allResults = [...localResults, ...federatedResults]

    // Deduplicate
    const deduplicated = deduplicateResults(allResults)

    // Sort by relevance score (descending)
    deduplicated.sort((a, b) => b.relevance_score - a.relevance_score)

    // Limit results
    const finalResults = deduplicated.slice(0, max_results)

    const queryTimeMs = Date.now() - startTime

    const response: SearchResponse = {
      results: finalResults,
      meta: {
        total: finalResults.length,
        local_count: finalResults.filter((r) => r.source === 'local').length,
        federated_count: finalResults.filter((r) => r.source === 'federated')
          .length,
        query_time_ms: queryTimeMs,
        partners_searched: partnersSearched,
      },
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (err) {
    console.error('Federated search error:', err)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS handler - CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400', // 24 hours
      },
    }
  )
}
