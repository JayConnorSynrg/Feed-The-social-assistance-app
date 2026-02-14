/**
 * Resource Deduplication Module
 *
 * Detects and merges duplicate resources from federation partners.
 * Uses multiple matching strategies with confidence scoring.
 */

export interface DeduplicationCandidate {
  id: string
  name: string
  address_line1?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  phone?: string | null
  latitude?: number | null
  longitude?: number | null
  source_instance_id: string
  trust_score: number
}

export interface DeduplicationResult {
  isDuplicate: boolean
  confidence: number // 0-1
  matchedResourceId?: string
  matchType?: 'exact' | 'fuzzy_name' | 'fuzzy_address' | 'geographic'
  mergedData?: Record<string, unknown>
}

/**
 * Normalize string for comparison
 * Removes common business suffixes, extra whitespace, and standardizes casing
 */
export function normalizeString(s: string): string {
  const suffixes = [
    'inc',
    'llc',
    'ltd',
    'corp',
    'corporation',
    'company',
    'co',
    'incorporated',
    'limited',
    'pllc',
    'lp',
    'pc',
  ]

  let normalized = s.toLowerCase().trim()

  // Remove punctuation except spaces
  normalized = normalized.replace(/[^\w\s]/g, ' ')

  // Replace multiple spaces with single space
  normalized = normalized.replace(/\s+/g, ' ')

  // Remove common suffixes
  for (const suffix of suffixes) {
    const pattern = new RegExp(`\\b${suffix}\\b`, 'g')
    normalized = normalized.replace(pattern, '')
  }

  // Final cleanup
  return normalized.trim()
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits required
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  // Handle empty strings
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate geographic distance between two points using Haversine formula
 * Returns distance in meters
 */
export function calculateGeographicDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3 // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Detect if a candidate resource is a duplicate of existing resources
 * Returns the best match with confidence score
 */
export function detectDuplicate(
  candidate: DeduplicationCandidate,
  existingResources: DeduplicationCandidate[]
): DeduplicationResult {
  let bestMatch: DeduplicationResult = {
    isDuplicate: false,
    confidence: 0,
  }

  const candidateNameNorm = normalizeString(candidate.name)
  const candidateAddressNorm = candidate.address_line1
    ? normalizeString(candidate.address_line1)
    : null

  for (const existing of existingResources) {
    const existingNameNorm = normalizeString(existing.name)
    const existingAddressNorm = existing.address_line1
      ? normalizeString(existing.address_line1)
      : null

    // 1. Exact match on name + address (confidence 1.0)
    if (
      candidateNameNorm === existingNameNorm &&
      candidateAddressNorm &&
      existingAddressNorm &&
      candidateAddressNorm === existingAddressNorm
    ) {
      return {
        isDuplicate: true,
        confidence: 1.0,
        matchedResourceId: existing.id,
        matchType: 'exact',
        mergedData: mergeResources(existing, candidate),
      }
    }

    // 2. Phone number match (confidence 0.9)
    if (candidate.phone && existing.phone) {
      const candidateDigits = candidate.phone.replace(/\D/g, '')
      const existingDigits = existing.phone.replace(/\D/g, '')
      if (candidateDigits === existingDigits && candidateDigits.length >= 10) {
        const result: DeduplicationResult = {
          isDuplicate: true,
          confidence: 0.9,
          matchedResourceId: existing.id,
          matchType: 'exact',
          mergedData: mergeResources(existing, candidate),
        }

        if (result.confidence > bestMatch.confidence) {
          bestMatch = result
        }
      }
    }

    // 3. Fuzzy name match + same city (confidence 0.8)
    const nameDistance = levenshteinDistance(candidateNameNorm, existingNameNorm)
    if (
      nameDistance < 3 &&
      nameDistance > 0 &&
      candidate.city &&
      existing.city &&
      normalizeString(candidate.city) === normalizeString(existing.city)
    ) {
      const result: DeduplicationResult = {
        isDuplicate: true,
        confidence: 0.8,
        matchedResourceId: existing.id,
        matchType: 'fuzzy_name',
        mergedData: mergeResources(existing, candidate),
      }

      if (result.confidence > bestMatch.confidence) {
        bestMatch = result
      }
    }

    // 4. Fuzzy address match + fuzzy name (confidence 0.75)
    if (candidateAddressNorm && existingAddressNorm) {
      const addressDistance = levenshteinDistance(candidateAddressNorm, existingAddressNorm)

      if (addressDistance < 3 && nameDistance < 3) {
        const result: DeduplicationResult = {
          isDuplicate: true,
          confidence: 0.75,
          matchedResourceId: existing.id,
          matchType: 'fuzzy_address',
          mergedData: mergeResources(existing, candidate),
        }

        if (result.confidence > bestMatch.confidence) {
          bestMatch = result
        }
      }
    }

    // 5. Geographic proximity (<50m) + fuzzy name (confidence 0.7)
    if (
      candidate.latitude != null &&
      candidate.longitude != null &&
      existing.latitude != null &&
      existing.longitude != null
    ) {
      const distance = calculateGeographicDistance(
        candidate.latitude,
        candidate.longitude,
        existing.latitude,
        existing.longitude
      )

      if (distance < 50 && nameDistance < 5) {
        const result: DeduplicationResult = {
          isDuplicate: true,
          confidence: 0.7,
          matchedResourceId: existing.id,
          matchType: 'geographic',
          mergedData: mergeResources(existing, candidate),
        }

        if (result.confidence > bestMatch.confidence) {
          bestMatch = result
        }
      }
    }
  }

  return bestMatch
}

/**
 * Merge two resource records, preferring data from higher trust score source
 * Combines unique values for array fields
 */
export function mergeResources(
  existing: DeduplicationCandidate,
  incoming: DeduplicationCandidate
): Record<string, unknown> {
  const preferExisting = existing.trust_score >= incoming.trust_score

  // Helper to select preferred value
  const prefer = <T>(existingVal: T, incomingVal: T): T => {
    if (existingVal === null || existingVal === undefined) return incomingVal
    if (incomingVal === null || incomingVal === undefined) return existingVal
    return preferExisting ? existingVal : incomingVal
  }

  // Build merged record
  const merged: Record<string, unknown> = {
    id: existing.id, // Keep existing ID
    name: prefer(existing.name, incoming.name),
    address_line1: prefer(existing.address_line1, incoming.address_line1),
    city: prefer(existing.city, incoming.city),
    state: prefer(existing.state, incoming.state),
    zip_code: prefer(existing.zip_code, incoming.zip_code),
    phone: prefer(existing.phone, incoming.phone),
    latitude: prefer(existing.latitude, incoming.latitude),
    longitude: prefer(existing.longitude, incoming.longitude),

    // Track both sources
    source_instance_ids: Array.from(
      new Set([existing.source_instance_id, incoming.source_instance_id])
    ),

    // Keep higher trust score
    trust_score: Math.max(existing.trust_score, incoming.trust_score),

    // Metadata
    merged_at: new Date().toISOString(),
    merged_from: [
      {
        id: existing.id,
        source_instance_id: existing.source_instance_id,
        trust_score: existing.trust_score,
      },
      {
        id: incoming.id,
        source_instance_id: incoming.source_instance_id,
        trust_score: incoming.trust_score,
      },
    ],
  }

  return merged
}
