/**
 * Trust Score Calculator
 *
 * Calculates weighted trust scores for federation peers based on multiple metrics.
 * Trust score ranges from 0.0 (untrusted) to 1.0 (fully trusted).
 */

export interface TrustMetrics {
  /**
   * Uptime percentage (0-100)
   * Weight: 30%
   */
  uptime?: number

  /**
   * Data quality score (0-100)
   * Based on completeness, accuracy, freshness
   * Weight: 25%
   */
  dataQuality?: number

  /**
   * Moderation compliance score (0-100)
   * Based on spam/abuse reports, response times
   * Weight: 20%
   */
  moderation?: number

  /**
   * Community trust score (0-100)
   * Based on user feedback, cross-instance reputation
   * Weight: 15%
   */
  community?: number

  /**
   * Instance longevity score (0-100)
   * Based on how long the instance has been federated
   * Weight: 10%
   */
  longevity?: number
}

export interface TrustCalculationResult {
  score: number
  breakdown: {
    uptime: { value: number; weight: number; contribution: number }
    dataQuality: { value: number; weight: number; contribution: number }
    moderation: { value: number; weight: number; contribution: number }
    community: { value: number; weight: number; contribution: number }
    longevity: { value: number; weight: number; contribution: number }
  }
  missingMetrics: string[]
}

// Weights for each metric
const WEIGHTS = {
  uptime: 0.30,
  dataQuality: 0.25,
  moderation: 0.20,
  community: 0.15,
  longevity: 0.10,
} as const

// Default values for missing metrics (conservative)
const DEFAULT_VALUES = {
  uptime: 50, // Assume average uptime
  dataQuality: 40, // Conservative default
  moderation: 50, // Neutral
  community: 30, // Low default for new instances
  longevity: 0, // New instances start at 0
} as const

/**
 * Calculate the weighted trust score from individual metrics
 *
 * @param metrics - Object containing individual trust metrics
 * @param useDefaults - Whether to use default values for missing metrics (default: true)
 * @returns Trust calculation result with score and breakdown
 */
export function calculateTrustScore(
  metrics: TrustMetrics,
  useDefaults: boolean = true
): TrustCalculationResult {
  const missingMetrics: string[] = []

  // Get values, using defaults if allowed
  const getValue = (key: keyof TrustMetrics): number => {
    const value = metrics[key]
    if (value === undefined || value === null) {
      missingMetrics.push(key)
      return useDefaults ? DEFAULT_VALUES[key] : 0
    }
    // Clamp to 0-100 range
    return Math.max(0, Math.min(100, value))
  }

  const values = {
    uptime: getValue('uptime'),
    dataQuality: getValue('dataQuality'),
    moderation: getValue('moderation'),
    community: getValue('community'),
    longevity: getValue('longevity'),
  }

  // Calculate weighted contributions
  const contributions = {
    uptime: (values.uptime / 100) * WEIGHTS.uptime,
    dataQuality: (values.dataQuality / 100) * WEIGHTS.dataQuality,
    moderation: (values.moderation / 100) * WEIGHTS.moderation,
    community: (values.community / 100) * WEIGHTS.community,
    longevity: (values.longevity / 100) * WEIGHTS.longevity,
  }

  // Sum all contributions for final score
  const score =
    contributions.uptime +
    contributions.dataQuality +
    contributions.moderation +
    contributions.community +
    contributions.longevity

  // Ensure score is in valid range
  const finalScore = Math.max(0, Math.min(1, score))

  return {
    score: Math.round(finalScore * 1000) / 1000, // Round to 3 decimal places
    breakdown: {
      uptime: {
        value: values.uptime,
        weight: WEIGHTS.uptime,
        contribution: Math.round(contributions.uptime * 1000) / 1000,
      },
      dataQuality: {
        value: values.dataQuality,
        weight: WEIGHTS.dataQuality,
        contribution: Math.round(contributions.dataQuality * 1000) / 1000,
      },
      moderation: {
        value: values.moderation,
        weight: WEIGHTS.moderation,
        contribution: Math.round(contributions.moderation * 1000) / 1000,
      },
      community: {
        value: values.community,
        weight: WEIGHTS.community,
        contribution: Math.round(contributions.community * 1000) / 1000,
      },
      longevity: {
        value: values.longevity,
        weight: WEIGHTS.longevity,
        contribution: Math.round(contributions.longevity * 1000) / 1000,
      },
    },
    missingMetrics,
  }
}

/**
 * Calculate longevity score based on federation age
 *
 * @param federatedSince - Date when federation started
 * @returns Longevity score 0-100
 */
export function calculateLongevityScore(federatedSince: Date): number {
  const now = new Date()
  const ageMs = now.getTime() - federatedSince.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  // Scoring tiers:
  // 0-7 days: 0-10
  // 7-30 days: 10-30
  // 30-90 days: 30-60
  // 90-180 days: 60-80
  // 180-365 days: 80-95
  // 365+ days: 95-100

  if (ageDays < 7) {
    return Math.round((ageDays / 7) * 10)
  } else if (ageDays < 30) {
    return Math.round(10 + ((ageDays - 7) / 23) * 20)
  } else if (ageDays < 90) {
    return Math.round(30 + ((ageDays - 30) / 60) * 30)
  } else if (ageDays < 180) {
    return Math.round(60 + ((ageDays - 90) / 90) * 20)
  } else if (ageDays < 365) {
    return Math.round(80 + ((ageDays - 180) / 185) * 15)
  } else {
    return Math.min(100, Math.round(95 + ((ageDays - 365) / 365) * 5))
  }
}

/**
 * Apply a trust score adjustment (increase or decrease)
 *
 * @param currentScore - Current trust score (0-1)
 * @param adjustment - Adjustment value (-1 to 1)
 * @param maxChange - Maximum change allowed per adjustment (default 0.1)
 * @returns New trust score
 */
export function adjustTrustScore(
  currentScore: number,
  adjustment: number,
  maxChange: number = 0.1
): number {
  const clampedAdjustment = Math.max(-maxChange, Math.min(maxChange, adjustment))
  const newScore = currentScore + clampedAdjustment
  return Math.max(0, Math.min(1, newScore))
}

/**
 * Calculate trust score delta from a specific event
 *
 * @param eventType - Type of event
 * @param severity - Event severity ('low' | 'medium' | 'high')
 * @returns Trust score adjustment
 */
export function getTrustAdjustmentForEvent(
  eventType:
    | 'health_check_success'
    | 'health_check_failure'
    | 'sync_success'
    | 'sync_failure'
    | 'data_quality_report'
    | 'spam_report'
    | 'user_complaint'
    | 'manual_boost'
    | 'manual_penalty',
  severity: 'low' | 'medium' | 'high' = 'medium'
): number {
  const severityMultiplier = { low: 0.5, medium: 1, high: 2 }[severity]

  const baseAdjustments: Record<string, number> = {
    health_check_success: 0.001, // Small positive for consistent uptime
    health_check_failure: -0.01, // Larger penalty for failures
    sync_success: 0.002, // Small positive for successful syncs
    sync_failure: -0.005, // Penalty for sync issues
    data_quality_report: 0.005, // Positive for quality data
    spam_report: -0.02, // Significant penalty for spam
    user_complaint: -0.01, // Penalty for complaints
    manual_boost: 0.05, // Admin manual boost
    manual_penalty: -0.05, // Admin manual penalty
  }

  const base = baseAdjustments[eventType] ?? 0
  return base * severityMultiplier
}
