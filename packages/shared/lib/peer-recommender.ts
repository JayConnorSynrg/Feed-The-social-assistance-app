/**
 * Peer Recommendation Engine for FEED Federation Protocol
 *
 * Suggests federation partners based on:
 * - Geographic proximity (Haversine distance)
 * - Trust score (from federation protocol)
 * - Resource count and complementarity
 * - Category overlap and gaps
 */

export interface PeerInstance {
  id: string
  instance_name: string
  instance_url: string
  latitude: number | null
  longitude: number | null
  trust_score: number
  resource_count: number
  categories: string[]
  status: string
}

export interface PeerRecommendation {
  instance: PeerInstance
  score: number
  distance_miles: number | null
  reasons: string[]
  complementary_categories: string[]
}

export interface RecommendationConfig {
  max_distance_miles: number  // default 100
  min_trust_score: number     // default 0.5
  max_recommendations: number // default 10
  boost_complementary: boolean // default true
  local_categories: string[]   // categories this instance has
  local_latitude?: number
  local_longitude?: number
}

interface ScoreResult {
  score: number
  reasons: string[]
  complementary: string[]
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns distance in miles
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959 // Earth's radius in miles
  const toRadians = (degrees: number) => degrees * (Math.PI / 180)

  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Calculate peer score and generate explanation
 *
 * Scoring breakdown:
 * - Trust: 0-40 points (trust_score * 40)
 * - Resources: 0-30 points (min(resource_count / 100, 1) * 30)
 * - Distance: 0-20 points (closer = higher, if coords available)
 * - Complementarity: 0-10 points (unique categories they offer)
 */
export function calculatePeerScore(
  instance: PeerInstance,
  config: RecommendationConfig,
  distance: number | null
): ScoreResult {
  const reasons: string[] = []
  let score = 0

  // Trust component (0-40 points)
  const trustScore = instance.trust_score * 40
  score += trustScore
  if (instance.trust_score >= 0.8) {
    reasons.push(`High trust score (${(instance.trust_score * 100).toFixed(0)}%)`)
  } else if (instance.trust_score >= 0.6) {
    reasons.push(`Good trust score (${(instance.trust_score * 100).toFixed(0)}%)`)
  }

  // Resource component (0-30 points)
  const resourceScore = Math.min(instance.resource_count / 100, 1) * 30
  score += resourceScore
  if (instance.resource_count >= 50) {
    reasons.push(`Large resource catalog (${instance.resource_count} resources)`)
  } else if (instance.resource_count >= 20) {
    reasons.push(`Active resource sharing (${instance.resource_count} resources)`)
  }

  // Distance component (0-20 points) - inverse: closer = higher score
  if (distance !== null) {
    const maxDistance = config.max_distance_miles
    const distanceScore = Math.max(0, (1 - distance / maxDistance) * 20)
    score += distanceScore

    if (distance <= 10) {
      reasons.push(`Very close proximity (${distance.toFixed(1)} miles)`)
    } else if (distance <= 25) {
      reasons.push(`Close proximity (${distance.toFixed(1)} miles)`)
    } else if (distance <= 50) {
      reasons.push(`Nearby location (${distance.toFixed(1)} miles)`)
    }
  }

  // Complementarity component (0-10 points)
  const complementaryCategories = config.boost_complementary
    ? instance.categories.filter(cat => !config.local_categories.includes(cat))
    : []

  const complementarityScore = config.boost_complementary
    ? Math.min(complementaryCategories.length / 5, 1) * 10
    : 0

  score += complementarityScore

  if (complementaryCategories.length > 0) {
    reasons.push(
      `Offers ${complementaryCategories.length} complementary ` +
      `categor${complementaryCategories.length === 1 ? 'y' : 'ies'}`
    )
  }

  // Add general reason if score is high but no specific reasons
  if (reasons.length === 0 && score > 30) {
    reasons.push('Solid overall match')
  }

  return {
    score: Math.round(score * 100) / 100, // Round to 2 decimals
    reasons,
    complementary: complementaryCategories
  }
}

/**
 * Recommend federation peers based on proximity, trust, and resource complementarity
 *
 * Algorithm:
 * 1. Filter out already-partnered instances
 * 2. Filter by minimum trust score threshold
 * 3. Calculate distance (if coordinates available)
 * 4. Filter by maximum distance
 * 5. Score each candidate
 * 6. Sort by score (descending)
 * 7. Return top N recommendations
 */
export function recommendPeers(
  candidates: PeerInstance[],
  partneredIds: string[],
  config: RecommendationConfig
): PeerRecommendation[] {
  // Step 1: Filter out already-partnered instances
  const availableCandidates = candidates.filter(
    instance => !partneredIds.includes(instance.id)
  )

  // Step 2: Filter by minimum trust score
  const trustedCandidates = availableCandidates.filter(
    instance => instance.trust_score >= config.min_trust_score
  )

  // Step 3-4: Calculate distances and filter by max distance
  const hasLocalCoords =
    config.local_latitude !== undefined &&
    config.local_longitude !== undefined

  const candidatesWithDistance = trustedCandidates.map(instance => {
    let distance: number | null = null

    if (hasLocalCoords && instance.latitude !== null && instance.longitude !== null) {
      distance = haversineDistance(
        config.local_latitude!,
        config.local_longitude!,
        instance.latitude,
        instance.longitude
      )
    }

    return { instance, distance }
  })

  // Filter by distance if we have coordinates
  const proximateCandidates = hasLocalCoords
    ? candidatesWithDistance.filter(
        ({ distance }) => distance === null || distance <= config.max_distance_miles
      )
    : candidatesWithDistance

  // Step 5: Score each candidate
  const scoredRecommendations: PeerRecommendation[] = proximateCandidates.map(
    ({ instance, distance }) => {
      const { score, reasons, complementary } = calculatePeerScore(
        instance,
        config,
        distance
      )

      return {
        instance,
        score,
        distance_miles: distance,
        reasons,
        complementary_categories: complementary
      }
    }
  )

  // Step 6: Sort by score (descending)
  scoredRecommendations.sort((a, b) => b.score - a.score)

  // Step 7: Return top N recommendations
  return scoredRecommendations.slice(0, config.max_recommendations)
}

/**
 * Create default recommendation configuration
 */
export function createDefaultConfig(
  overrides?: Partial<RecommendationConfig>
): RecommendationConfig {
  return {
    max_distance_miles: 100,
    min_trust_score: 0.5,
    max_recommendations: 10,
    boost_complementary: true,
    local_categories: [],
    ...overrides
  }
}
