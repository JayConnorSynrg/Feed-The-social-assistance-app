/**
 * Trust Level Classification
 *
 * Classifies numeric trust scores into discrete trust levels
 * and defines permissions for each level.
 */

export type TrustLevel = 'untrusted' | 'pending' | 'trusted' | 'verified' | 'core'

export interface TrustLevelConfig {
  level: TrustLevel
  minScore: number
  maxScore: number
  displayName: string
  description: string
  color: string
  permissions: TrustPermissions
}

export interface TrustPermissions {
  /**
   * Can receive resources via federation
   */
  canReceiveResources: boolean

  /**
   * Can send resources to this instance
   */
  canSendResources: boolean

  /**
   * Can perform real-time federated searches
   */
  canRealtimeSearch: boolean

  /**
   * Can receive webhook notifications
   */
  canReceiveWebhooks: boolean

  /**
   * Can send webhook notifications
   */
  canSendWebhooks: boolean

  /**
   * Maximum sync frequency (minutes)
   */
  maxSyncFrequencyMinutes: number

  /**
   * Maximum resources per sync
   */
  maxResourcesPerSync: number

  /**
   * Rate limit (requests per minute)
   */
  rateLimitPerMinute: number

  /**
   * Can be recommended to other instances
   */
  canBeRecommended: boolean

  /**
   * Auto-approve new resources without review
   */
  autoApproveResources: boolean
}

/**
 * Trust level configuration thresholds and permissions
 */
export const TRUST_LEVELS: TrustLevelConfig[] = [
  {
    level: 'untrusted',
    minScore: 0.0,
    maxScore: 0.2,
    displayName: 'Untrusted',
    description: 'New or problematic instance with minimal trust',
    color: 'red',
    permissions: {
      canReceiveResources: false,
      canSendResources: false,
      canRealtimeSearch: false,
      canReceiveWebhooks: false,
      canSendWebhooks: false,
      maxSyncFrequencyMinutes: 1440, // Daily
      maxResourcesPerSync: 10,
      rateLimitPerMinute: 5,
      canBeRecommended: false,
      autoApproveResources: false,
    },
  },
  {
    level: 'pending',
    minScore: 0.2,
    maxScore: 0.4,
    displayName: 'Pending',
    description: 'Under evaluation, limited federation',
    color: 'yellow',
    permissions: {
      canReceiveResources: true,
      canSendResources: false,
      canRealtimeSearch: false,
      canReceiveWebhooks: false,
      canSendWebhooks: false,
      maxSyncFrequencyMinutes: 60, // Hourly
      maxResourcesPerSync: 50,
      rateLimitPerMinute: 20,
      canBeRecommended: false,
      autoApproveResources: false,
    },
  },
  {
    level: 'trusted',
    minScore: 0.4,
    maxScore: 0.7,
    displayName: 'Trusted',
    description: 'Established partner with standard federation',
    color: 'blue',
    permissions: {
      canReceiveResources: true,
      canSendResources: true,
      canRealtimeSearch: false,
      canReceiveWebhooks: true,
      canSendWebhooks: true,
      maxSyncFrequencyMinutes: 15, // Every 15 minutes
      maxResourcesPerSync: 200,
      rateLimitPerMinute: 60,
      canBeRecommended: true,
      autoApproveResources: false,
    },
  },
  {
    level: 'verified',
    minScore: 0.7,
    maxScore: 0.9,
    displayName: 'Verified',
    description: 'High-trust partner with full federation',
    color: 'green',
    permissions: {
      canReceiveResources: true,
      canSendResources: true,
      canRealtimeSearch: true,
      canReceiveWebhooks: true,
      canSendWebhooks: true,
      maxSyncFrequencyMinutes: 5, // Every 5 minutes
      maxResourcesPerSync: 500,
      rateLimitPerMinute: 100,
      canBeRecommended: true,
      autoApproveResources: true,
    },
  },
  {
    level: 'core',
    minScore: 0.9,
    maxScore: 1.0,
    displayName: 'Core',
    description: 'Core network partner with maximum trust',
    color: 'purple',
    permissions: {
      canReceiveResources: true,
      canSendResources: true,
      canRealtimeSearch: true,
      canReceiveWebhooks: true,
      canSendWebhooks: true,
      maxSyncFrequencyMinutes: 1, // Every minute
      maxResourcesPerSync: 1000,
      rateLimitPerMinute: 200,
      canBeRecommended: true,
      autoApproveResources: true,
    },
  },
]

/**
 * Classify a trust score into a trust level
 *
 * @param score - Trust score (0.0 to 1.0)
 * @returns Trust level
 */
export function classifyTrustLevel(score: number): TrustLevel {
  // Ensure score is in valid range
  const clampedScore = Math.max(0, Math.min(1, score))

  // Find matching level (check from highest to lowest)
  for (let i = TRUST_LEVELS.length - 1; i >= 0; i--) {
    const level = TRUST_LEVELS[i]
    if (clampedScore >= level.minScore && clampedScore <= level.maxScore) {
      return level.level
    }
  }

  // Default to untrusted if no match (shouldn't happen)
  return 'untrusted'
}

/**
 * Get the configuration for a trust level
 *
 * @param level - Trust level
 * @returns Trust level configuration
 */
export function getTrustLevelConfig(level: TrustLevel): TrustLevelConfig {
  return TRUST_LEVELS.find((l) => l.level === level) || TRUST_LEVELS[0]
}

/**
 * Get permissions for a trust score
 *
 * @param score - Trust score (0.0 to 1.0)
 * @returns Trust permissions
 */
export function getPermissionsForScore(score: number): TrustPermissions {
  const level = classifyTrustLevel(score)
  return getTrustLevelConfig(level).permissions
}

/**
 * Check if a trust level meets a minimum requirement
 *
 * @param current - Current trust level
 * @param minimum - Minimum required trust level
 * @returns True if current meets or exceeds minimum
 */
export function meetsTrustRequirement(current: TrustLevel, minimum: TrustLevel): boolean {
  const levels: TrustLevel[] = ['untrusted', 'pending', 'trusted', 'verified', 'core']
  const currentIndex = levels.indexOf(current)
  const minimumIndex = levels.indexOf(minimum)
  return currentIndex >= minimumIndex
}

/**
 * Get the next trust level up
 *
 * @param current - Current trust level
 * @returns Next level up, or null if already at max
 */
export function getNextTrustLevel(current: TrustLevel): TrustLevel | null {
  const levels: TrustLevel[] = ['untrusted', 'pending', 'trusted', 'verified', 'core']
  const currentIndex = levels.indexOf(current)
  if (currentIndex < levels.length - 1) {
    return levels[currentIndex + 1]
  }
  return null
}

/**
 * Get the score needed to reach the next trust level
 *
 * @param currentScore - Current trust score
 * @returns Score needed, or null if at max level
 */
export function getScoreForNextLevel(currentScore: number): number | null {
  const currentLevel = classifyTrustLevel(currentScore)
  const nextLevel = getNextTrustLevel(currentLevel)

  if (!nextLevel) return null

  const nextConfig = getTrustLevelConfig(nextLevel)
  return nextConfig.minScore
}

/**
 * Calculate how close a score is to the next level (0-100%)
 *
 * @param currentScore - Current trust score
 * @returns Progress percentage to next level
 */
export function getProgressToNextLevel(currentScore: number): number {
  const currentLevel = classifyTrustLevel(currentScore)
  const currentConfig = getTrustLevelConfig(currentLevel)

  // If at max level, return 100%
  if (currentLevel === 'core') {
    return 100
  }

  const nextConfig = getTrustLevelConfig(getNextTrustLevel(currentLevel)!)

  const rangeStart = currentConfig.minScore
  const rangeEnd = nextConfig.minScore
  const range = rangeEnd - rangeStart

  if (range <= 0) return 100

  const progress = (currentScore - rangeStart) / range
  return Math.round(progress * 100)
}
