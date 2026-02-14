/**
 * Result Ranking Algorithm for FEED Federation Protocol
 *
 * Provides multi-factor ranking for search results from local and federated sources.
 * Factors include: relevance, trust, distance, freshness, and completeness.
 */

export interface SearchResult {
  id: string
  name: string
  description: string | null
  category: string
  address_line1: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  latitude: number | null
  longitude: number | null
  source: 'local' | 'federated'
  source_instance_id?: string
  source_instance_name?: string
  trust_score: number // 0-1, local resources default to 1.0
  last_synced_at?: string
  updated_at: string
  relevance_score?: number // Set by ranker
  distance_meters?: number | null // Set by location search
}

export interface RankingWeights {
  relevance: number    // default 0.35
  trust: number        // default 0.25
  distance: number     // default 0.20
  freshness: number    // default 0.10
  completeness: number // default 0.10
}

export interface RankingOptions {
  query: string
  userLocation?: { lat: number; lng: number }
  weights?: Partial<RankingWeights>
  localBoost?: number // default 1.1 (10% boost for local resources)
}

const DEFAULT_WEIGHTS: RankingWeights = {
  relevance: 0.35,
  trust: 0.25,
  distance: 0.20,
  freshness: 0.10,
  completeness: 0.10,
}

const DEFAULT_LOCAL_BOOST = 1.1

/**
 * Normalize a string for comparison
 */
function normalizeString(str: string): string {
  return str.toLowerCase().trim()
}

/**
 * Calculate relevance score based on text matching
 * Returns a score between 0 and 1
 */
export function calculateRelevanceScore(
  result: SearchResult,
  query: string
): number {
  const normalizedQuery = normalizeString(query)
  const normalizedName = normalizeString(result.name)
  const normalizedDescription = result.description ? normalizeString(result.description) : ''
  const normalizedCategory = normalizeString(result.category)

  // Exact name match
  if (normalizedName === normalizedQuery) {
    return 1.0
  }

  // Name contains query
  if (normalizedName.includes(normalizedQuery)) {
    return 0.8
  }

  // Word overlap in name
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0)
  const nameWords = normalizedName.split(/\s+/).filter(w => w.length > 0)

  if (queryWords.length > 0 && nameWords.length > 0) {
    const matchingWords = queryWords.filter(qw =>
      nameWords.some(nw => nw.includes(qw) || qw.includes(nw))
    )

    if (matchingWords.length > 0) {
      const overlapRatio = matchingWords.length / queryWords.length
      if (overlapRatio > 0.5) {
        return 0.6
      }
    }
  }

  // Description contains query
  if (normalizedDescription && normalizedDescription.includes(normalizedQuery)) {
    return 0.4
  }

  // Category matches query
  if (normalizedCategory === normalizedQuery || normalizedCategory.includes(normalizedQuery)) {
    return 0.3
  }

  // No match
  return 0.0
}

/**
 * Calculate freshness score based on update and sync timestamps
 * Returns a score between 0 and 1
 */
export function calculateFreshnessScore(
  updatedAt: string,
  syncedAt?: string
): number {
  // Use the more recent of updatedAt or syncedAt
  const timestamp = syncedAt && new Date(syncedAt) > new Date(updatedAt)
    ? syncedAt
    : updatedAt

  const now = new Date()
  const updated = new Date(timestamp)
  const ageMs = now.getTime() - updated.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  // Updated today
  if (ageDays < 1) {
    return 1.0
  }

  // Updated this week
  if (ageDays < 7) {
    return 0.8
  }

  // Updated this month
  if (ageDays < 30) {
    return 0.6
  }

  // Older
  return 0.3
}

/**
 * Calculate completeness score based on populated fields
 * Returns a score between 0 and 1
 */
export function calculateCompletenessScore(
  result: SearchResult
): number {
  const fields = [
    result.name,
    result.description,
    result.address_line1,
    result.city,
    result.state,
    result.zip_code,
    result.phone,
    result.latitude,
    result.longitude,
  ]

  const populatedFields = fields.filter(field => {
    if (field === null || field === undefined) return false
    if (typeof field === 'string' && field.trim().length === 0) return false
    return true
  })

  return populatedFields.length / fields.length
}

/**
 * Calculate distance score based on distance in meters
 * Returns a score between 0 and 1
 */
export function calculateDistanceScore(
  distanceMeters: number | null | undefined
): number {
  if (distanceMeters === null || distanceMeters === undefined) {
    return 0.1
  }

  // < 1km
  if (distanceMeters < 1000) {
    return 1.0
  }

  // < 5km
  if (distanceMeters < 5000) {
    return 0.8
  }

  // < 10km
  if (distanceMeters < 10000) {
    return 0.6
  }

  // < 25km
  if (distanceMeters < 25000) {
    return 0.4
  }

  // < 50km
  if (distanceMeters < 50000) {
    return 0.2
  }

  // >= 50km
  return 0.1
}

/**
 * Rank search results by multiple factors
 * Returns results sorted by composite score (highest first)
 */
export function rankResults(
  results: SearchResult[],
  options: RankingOptions
): SearchResult[] {
  const { query, userLocation, weights: customWeights, localBoost = DEFAULT_LOCAL_BOOST } = options

  // Merge custom weights with defaults
  let weights = { ...DEFAULT_WEIGHTS, ...customWeights }

  // If no user location, redistribute distance weight to other factors
  if (!userLocation) {
    const distanceWeight = weights.distance
    weights.distance = 0

    // Redistribute proportionally to other factors
    const remainingTotal = weights.relevance + weights.trust + weights.freshness + weights.completeness
    if (remainingTotal > 0) {
      const redistributionFactor = (remainingTotal + distanceWeight) / remainingTotal
      weights.relevance *= redistributionFactor
      weights.trust *= redistributionFactor
      weights.freshness *= redistributionFactor
      weights.completeness *= redistributionFactor
    }
  }

  // Calculate composite score for each result
  const scoredResults = results.map(result => {
    const relevanceScore = calculateRelevanceScore(result, query)
    const trustScore = result.trust_score
    const distanceScore = calculateDistanceScore(result.distance_meters)
    const freshnessScore = calculateFreshnessScore(result.updated_at, result.last_synced_at)
    const completenessScore = calculateCompletenessScore(result)

    let compositeScore =
      weights.relevance * relevanceScore +
      weights.trust * trustScore +
      weights.distance * distanceScore +
      weights.freshness * freshnessScore +
      weights.completeness * completenessScore

    // Apply local boost
    if (result.source === 'local') {
      compositeScore *= localBoost
    }

    return {
      ...result,
      relevance_score: compositeScore,
    }
  })

  // Sort by composite score (highest first)
  scoredResults.sort((a, b) => {
    const scoreA = a.relevance_score ?? 0
    const scoreB = b.relevance_score ?? 0
    return scoreB - scoreA
  })

  return scoredResults
}
