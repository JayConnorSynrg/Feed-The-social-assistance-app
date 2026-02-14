/**
 * Uptime Calculator
 *
 * Calculates uptime percentage from health check history.
 * Used as a component of the trust score calculation.
 */

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  response_time_ms: number
  checked_at: string | Date
}

export interface UptimeResult {
  /**
   * Uptime percentage (0-100)
   */
  uptimePercentage: number

  /**
   * Total health checks in period
   */
  totalChecks: number

  /**
   * Successful checks (healthy)
   */
  healthyChecks: number

  /**
   * Degraded checks
   */
  degradedChecks: number

  /**
   * Failed checks (unhealthy)
   */
  unhealthyChecks: number

  /**
   * Average response time (ms)
   */
  averageResponseTime: number

  /**
   * P95 response time (ms)
   */
  p95ResponseTime: number

  /**
   * Start of measurement period
   */
  periodStart: Date

  /**
   * End of measurement period
   */
  periodEnd: Date
}

/**
 * Calculate uptime from health check records
 *
 * @param checks - Array of health check records
 * @param days - Number of days to calculate (default 30)
 * @returns Uptime calculation result, or null if no data
 */
export function calculateUptime(
  checks: HealthCheck[],
  days: number = 30
): UptimeResult | null {
  if (checks.length === 0) {
    return null
  }

  const now = new Date()
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const periodEnd = now

  // Filter checks within the period
  const periodChecks = checks.filter((check) => {
    const checkDate = new Date(check.checked_at)
    return checkDate >= periodStart && checkDate <= periodEnd
  })

  if (periodChecks.length === 0) {
    return null
  }

  // Count by status
  const healthyChecks = periodChecks.filter((c) => c.status === 'healthy').length
  const degradedChecks = periodChecks.filter((c) => c.status === 'degraded').length
  const unhealthyChecks = periodChecks.filter((c) => c.status === 'unhealthy').length
  const totalChecks = periodChecks.length

  // Calculate uptime percentage
  // Healthy = 100%, Degraded = 50%, Unhealthy = 0%
  const weightedUptime =
    (healthyChecks * 1.0 + degradedChecks * 0.5 + unhealthyChecks * 0) / totalChecks
  const uptimePercentage = Math.round(weightedUptime * 100 * 100) / 100 // 2 decimal places

  // Calculate response time stats
  const responseTimes = periodChecks.map((c) => c.response_time_ms).sort((a, b) => a - b)
  const averageResponseTime =
    Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
  const p95Index = Math.floor(responseTimes.length * 0.95)
  const p95ResponseTime = responseTimes[p95Index] ?? responseTimes[responseTimes.length - 1]

  return {
    uptimePercentage,
    totalChecks,
    healthyChecks,
    degradedChecks,
    unhealthyChecks,
    averageResponseTime,
    p95ResponseTime,
    periodStart,
    periodEnd,
  }
}

/**
 * Convert uptime percentage to a 0-100 score for trust calculation
 *
 * Uses a slightly generous curve to not overly penalize occasional issues
 *
 * @param uptimePercentage - Uptime percentage (0-100)
 * @returns Score for trust calculation (0-100)
 */
export function uptimeToScore(uptimePercentage: number): number {
  // Thresholds:
  // 99-100% = 95-100 score
  // 95-99% = 80-95 score
  // 90-95% = 60-80 score
  // 80-90% = 40-60 score
  // 70-80% = 20-40 score
  // <70% = 0-20 score

  if (uptimePercentage >= 99) {
    return 95 + ((uptimePercentage - 99) / 1) * 5
  } else if (uptimePercentage >= 95) {
    return 80 + ((uptimePercentage - 95) / 4) * 15
  } else if (uptimePercentage >= 90) {
    return 60 + ((uptimePercentage - 90) / 5) * 20
  } else if (uptimePercentage >= 80) {
    return 40 + ((uptimePercentage - 80) / 10) * 20
  } else if (uptimePercentage >= 70) {
    return 20 + ((uptimePercentage - 70) / 10) * 20
  } else {
    return Math.max(0, (uptimePercentage / 70) * 20)
  }
}

/**
 * Calculate expected checks for a period
 *
 * @param days - Number of days
 * @param intervalMinutes - Check interval in minutes (default 5)
 * @returns Expected number of checks
 */
export function getExpectedChecks(days: number, intervalMinutes: number = 5): number {
  return Math.floor((days * 24 * 60) / intervalMinutes)
}

/**
 * Calculate data coverage (actual vs expected checks)
 *
 * @param actualChecks - Number of actual checks
 * @param days - Period in days
 * @param intervalMinutes - Expected interval between checks
 * @returns Coverage percentage (0-100)
 */
export function calculateDataCoverage(
  actualChecks: number,
  days: number,
  intervalMinutes: number = 5
): number {
  const expected = getExpectedChecks(days, intervalMinutes)
  if (expected === 0) return 0
  return Math.min(100, Math.round((actualChecks / expected) * 100))
}

/**
 * Format uptime for display
 *
 * @param uptimePercentage - Uptime percentage
 * @returns Formatted string like "99.9%"
 */
export function formatUptime(uptimePercentage: number): string {
  if (uptimePercentage >= 99.9) {
    return `${uptimePercentage.toFixed(2)}%`
  } else if (uptimePercentage >= 90) {
    return `${uptimePercentage.toFixed(1)}%`
  } else {
    return `${Math.round(uptimePercentage)}%`
  }
}

/**
 * Get uptime status label
 *
 * @param uptimePercentage - Uptime percentage
 * @returns Status label
 */
export function getUptimeStatus(
  uptimePercentage: number
): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
  if (uptimePercentage >= 99.5) return 'excellent'
  if (uptimePercentage >= 95) return 'good'
  if (uptimePercentage >= 90) return 'fair'
  if (uptimePercentage >= 70) return 'poor'
  return 'critical'
}
