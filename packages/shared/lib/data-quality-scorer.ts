/**
 * Data Quality Scorer
 *
 * Scores the quality of federated resource data based on multiple metrics.
 * Used as a component of the trust score calculation.
 */

export interface ResourceData {
  id: string
  name: string
  description?: string | null
  resource_type?: string | null
  address_line1?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  latitude?: number | null
  longitude?: number | null
  hours_of_operation?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  is_verified?: boolean | null
  updated_at?: string | Date | null
  created_at?: string | Date | null
}

export interface DataQualityResult {
  /**
   * Overall quality score (0-100)
   */
  score: number

  /**
   * Completeness score (0-100)
   * Percentage of important fields populated
   */
  completeness: number

  /**
   * Accuracy score (0-100)
   * Based on validation and user reports
   */
  accuracy: number

  /**
   * Freshness score (0-100)
   * Based on how recently updated
   */
  freshness: number

  /**
   * Validity score (0-100)
   * Based on data format validation
   */
  validity: number

  /**
   * Number of resources analyzed
   */
  resourceCount: number

  /**
   * Issues found
   */
  issues: DataQualityIssue[]
}

export interface DataQualityIssue {
  severity: 'low' | 'medium' | 'high'
  category: 'completeness' | 'accuracy' | 'freshness' | 'validity'
  message: string
  resourceIds?: string[]
  count?: number
}

// Required fields for completeness calculation
const REQUIRED_FIELDS = ['name', 'resource_type'] as const
const IMPORTANT_FIELDS = [
  'description',
  'address_line1',
  'city',
  'state',
  'phone',
] as const
const OPTIONAL_FIELDS = [
  'zip_code',
  'email',
  'website',
  'latitude',
  'longitude',
  'hours_of_operation',
] as const

// Weights for overall score
const WEIGHTS = {
  completeness: 0.35,
  accuracy: 0.25,
  freshness: 0.20,
  validity: 0.20,
}

// Freshness thresholds (days)
const FRESHNESS_THRESHOLDS = {
  veryFresh: 7, // Within 7 days = 100%
  fresh: 30, // Within 30 days = 80%
  moderate: 90, // Within 90 days = 60%
  stale: 180, // Within 180 days = 40%
  veryStale: 365, // Within 365 days = 20%
  // Older = 0%
}

/**
 * Calculate data quality score for a set of resources
 *
 * @param resources - Array of resource data to analyze
 * @param userReports - Optional accuracy data from user reports
 * @returns Data quality result
 */
export function calculateDataQuality(
  resources: ResourceData[],
  userReports?: { accurateCount: number; inaccurateCount: number }
): DataQualityResult {
  if (resources.length === 0) {
    return {
      score: 0,
      completeness: 0,
      accuracy: 100, // Default to 100 if no reports
      freshness: 0,
      validity: 0,
      resourceCount: 0,
      issues: [],
    }
  }

  const issues: DataQualityIssue[] = []

  // Calculate completeness
  const completeness = calculateCompleteness(resources, issues)

  // Calculate accuracy (from user reports)
  const accuracy = calculateAccuracy(userReports, issues)

  // Calculate freshness
  const freshness = calculateFreshness(resources, issues)

  // Calculate validity
  const validity = calculateValidity(resources, issues)

  // Calculate weighted overall score
  const score = Math.round(
    completeness * WEIGHTS.completeness +
      accuracy * WEIGHTS.accuracy +
      freshness * WEIGHTS.freshness +
      validity * WEIGHTS.validity
  )

  return {
    score,
    completeness: Math.round(completeness),
    accuracy: Math.round(accuracy),
    freshness: Math.round(freshness),
    validity: Math.round(validity),
    resourceCount: resources.length,
    issues,
  }
}

/**
 * Calculate completeness score
 */
function calculateCompleteness(
  resources: ResourceData[],
  issues: DataQualityIssue[]
): number {
  let totalScore = 0
  const missingRequiredIds: string[] = []
  const missingImportantIds: string[] = []

  for (const resource of resources) {
    let resourceScore = 0
    let maxScore = 0

    // Required fields (weighted more)
    for (const field of REQUIRED_FIELDS) {
      maxScore += 3
      if (hasValue(resource[field as keyof ResourceData])) {
        resourceScore += 3
      } else {
        missingRequiredIds.push(resource.id)
      }
    }

    // Important fields
    for (const field of IMPORTANT_FIELDS) {
      maxScore += 2
      if (hasValue(resource[field as keyof ResourceData])) {
        resourceScore += 2
      } else {
        missingImportantIds.push(resource.id)
      }
    }

    // Optional fields
    for (const field of OPTIONAL_FIELDS) {
      maxScore += 1
      if (hasValue(resource[field as keyof ResourceData])) {
        resourceScore += 1
      }
    }

    totalScore += (resourceScore / maxScore) * 100
  }

  // Add issues
  if (missingRequiredIds.length > 0) {
    issues.push({
      severity: 'high',
      category: 'completeness',
      message: `${missingRequiredIds.length} resources missing required fields`,
      count: missingRequiredIds.length,
    })
  }

  if (missingImportantIds.length > resources.length * 0.2) {
    issues.push({
      severity: 'medium',
      category: 'completeness',
      message: `Many resources missing important fields`,
      count: missingImportantIds.length,
    })
  }

  return totalScore / resources.length
}

/**
 * Calculate accuracy score from user reports
 */
function calculateAccuracy(
  userReports: { accurateCount: number; inaccurateCount: number } | undefined,
  issues: DataQualityIssue[]
): number {
  if (!userReports) {
    return 80 // Default score if no user reports
  }

  const total = userReports.accurateCount + userReports.inaccurateCount
  if (total === 0) {
    return 80 // Default if no reports
  }

  const accuracyRate = (userReports.accurateCount / total) * 100

  if (userReports.inaccurateCount > 0) {
    const severity = userReports.inaccurateCount > 10 ? 'high' : 'medium'
    issues.push({
      severity,
      category: 'accuracy',
      message: `${userReports.inaccurateCount} user reports of inaccurate data`,
      count: userReports.inaccurateCount,
    })
  }

  return accuracyRate
}

/**
 * Calculate freshness score
 */
function calculateFreshness(
  resources: ResourceData[],
  issues: DataQualityIssue[]
): number {
  const now = new Date()
  let totalScore = 0
  let staleCount = 0

  for (const resource of resources) {
    const updatedAt = resource.updated_at ? new Date(resource.updated_at) : null
    const createdAt = resource.created_at ? new Date(resource.created_at) : null
    const lastModified = updatedAt || createdAt

    if (!lastModified) {
      totalScore += 50 // Unknown = neutral
      continue
    }

    const daysOld = (now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24)

    if (daysOld <= FRESHNESS_THRESHOLDS.veryFresh) {
      totalScore += 100
    } else if (daysOld <= FRESHNESS_THRESHOLDS.fresh) {
      totalScore += 80
    } else if (daysOld <= FRESHNESS_THRESHOLDS.moderate) {
      totalScore += 60
    } else if (daysOld <= FRESHNESS_THRESHOLDS.stale) {
      totalScore += 40
      staleCount++
    } else if (daysOld <= FRESHNESS_THRESHOLDS.veryStale) {
      totalScore += 20
      staleCount++
    } else {
      totalScore += 0
      staleCount++
    }
  }

  if (staleCount > resources.length * 0.3) {
    issues.push({
      severity: 'medium',
      category: 'freshness',
      message: `${staleCount} resources have stale data (>6 months old)`,
      count: staleCount,
    })
  }

  return totalScore / resources.length
}

/**
 * Calculate validity score
 */
function calculateValidity(
  resources: ResourceData[],
  issues: DataQualityIssue[]
): number {
  let validCount = 0
  const invalidPhoneIds: string[] = []
  const invalidEmailIds: string[] = []
  const invalidZipIds: string[] = []

  for (const resource of resources) {
    let resourceValid = true

    // Validate phone
    if (resource.phone && !isValidPhone(resource.phone)) {
      invalidPhoneIds.push(resource.id)
      resourceValid = false
    }

    // Validate email
    if (resource.email && !isValidEmail(resource.email)) {
      invalidEmailIds.push(resource.id)
      resourceValid = false
    }

    // Validate zip code
    if (resource.zip_code && !isValidZipCode(resource.zip_code)) {
      invalidZipIds.push(resource.id)
      resourceValid = false
    }

    // Validate coordinates
    if (resource.latitude !== null && resource.latitude !== undefined) {
      if (resource.latitude < -90 || resource.latitude > 90) {
        resourceValid = false
      }
    }
    if (resource.longitude !== null && resource.longitude !== undefined) {
      if (resource.longitude < -180 || resource.longitude > 180) {
        resourceValid = false
      }
    }

    if (resourceValid) {
      validCount++
    }
  }

  // Add issues
  if (invalidPhoneIds.length > 0) {
    issues.push({
      severity: 'low',
      category: 'validity',
      message: `${invalidPhoneIds.length} resources have invalid phone formats`,
      count: invalidPhoneIds.length,
    })
  }

  if (invalidEmailIds.length > 0) {
    issues.push({
      severity: 'low',
      category: 'validity',
      message: `${invalidEmailIds.length} resources have invalid email formats`,
      count: invalidEmailIds.length,
    })
  }

  return (validCount / resources.length) * 100
}

// Utility functions

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  if (typeof value === 'object' && Object.keys(value).length === 0) return false
  return true
}

function isValidPhone(phone: string): boolean {
  // Accept various phone formats
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function isValidZipCode(zip: string): boolean {
  // US zip codes (5 or 9 digits)
  const usZipRegex = /^\d{5}(-\d{4})?$/
  return usZipRegex.test(zip)
}
