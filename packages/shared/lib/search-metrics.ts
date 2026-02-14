/**
 * Search Performance Monitoring Module
 *
 * Tracks and analyzes search performance metrics for the FEED Federation Protocol.
 * Provides insights into query performance, cache effectiveness, and federated search contribution.
 */

export interface SearchMetricEvent {
  query: string
  category?: string
  hasLocation: boolean
  includeFederated: boolean
  totalResults: number
  localResults: number
  federatedResults: number
  queryTimeMs: number
  cacheHit: boolean
  realtimePartnersQueried: number
  realtimePartnersSucceeded: number
  realtimeQueryTimeMs: number
  timestamp: string
}

export interface AggregatedMetrics {
  timeWindow: string
  totalSearches: number
  avgQueryTimeMs: number
  p50QueryTimeMs: number
  p95QueryTimeMs: number
  p99QueryTimeMs: number
  avgResults: number
  avgLocalResults: number
  avgFederatedResults: number
  cacheHitRate: number
  realtimeSuccessRate: number
  topCategories: Array<{ category: string; count: number }>
  topQueries: Array<{ query: string; count: number }>
  federatedRatio: number
}

interface PartnerContribution {
  partnerId: string
  partnerName: string
  resourceCount: number
  avgResponseTime: number
}

/**
 * Calculate percentile value from a sorted array of numbers
 * Uses the nearest-rank method
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  if (percentile < 0 || percentile > 100) {
    throw new Error('Percentile must be between 0 and 100')
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

/**
 * Compute aggregate statistics from raw search metric events
 */
export function aggregateMetrics(
  events: SearchMetricEvent[],
  timeWindow: string
): AggregatedMetrics {
  if (events.length === 0) {
    return {
      timeWindow,
      totalSearches: 0,
      avgQueryTimeMs: 0,
      p50QueryTimeMs: 0,
      p95QueryTimeMs: 0,
      p99QueryTimeMs: 0,
      avgResults: 0,
      avgLocalResults: 0,
      avgFederatedResults: 0,
      cacheHitRate: 0,
      realtimeSuccessRate: 0,
      topCategories: [],
      topQueries: [],
      federatedRatio: 0,
    }
  }

  const queryTimes = events.map(e => e.queryTimeMs)
  const totalResults = events.reduce((sum, e) => sum + e.totalResults, 0)
  const totalLocalResults = events.reduce((sum, e) => sum + e.localResults, 0)
  const totalFederatedResults = events.reduce((sum, e) => sum + e.federatedResults, 0)
  const cacheHits = events.filter(e => e.cacheHit).length

  const realtimeEvents = events.filter(e => e.realtimePartnersQueried > 0)
  const realtimeSuccess = realtimeEvents.reduce(
    (sum, e) => sum + e.realtimePartnersSucceeded,
    0
  )
  const realtimeTotal = realtimeEvents.reduce(
    (sum, e) => sum + e.realtimePartnersQueried,
    0
  )

  // Category aggregation
  const categoryMap = new Map<string, number>()
  events.forEach(e => {
    if (e.category) {
      categoryMap.set(e.category, (categoryMap.get(e.category) || 0) + 1)
    }
  })
  const topCategories = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Query aggregation
  const queryMap = new Map<string, number>()
  events.forEach(e => {
    const normalizedQuery = e.query.toLowerCase().trim()
    queryMap.set(normalizedQuery, (queryMap.get(normalizedQuery) || 0) + 1)
  })
  const topQueries = Array.from(queryMap.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    timeWindow,
    totalSearches: events.length,
    avgQueryTimeMs: queryTimes.reduce((sum, t) => sum + t, 0) / events.length,
    p50QueryTimeMs: calculatePercentile(queryTimes, 50),
    p95QueryTimeMs: calculatePercentile(queryTimes, 95),
    p99QueryTimeMs: calculatePercentile(queryTimes, 99),
    avgResults: totalResults / events.length,
    avgLocalResults: totalLocalResults / events.length,
    avgFederatedResults: totalFederatedResults / events.length,
    cacheHitRate: (cacheHits / events.length) * 100,
    realtimeSuccessRate: realtimeTotal > 0 ? (realtimeSuccess / realtimeTotal) * 100 : 0,
    topCategories,
    topQueries,
    federatedRatio: totalResults > 0 ? (totalFederatedResults / totalResults) * 100 : 0,
  }
}

/**
 * Create a search metrics collector instance
 */
export function createSearchMetricsCollector(supabaseClient: any) {
  const TABLE_NAME = 'federation_search_metrics'

  return {
    /**
     * Record a search metric event
     */
    async recordSearch(event: SearchMetricEvent): Promise<void> {
      try {
        const { error } = await supabaseClient.from(TABLE_NAME).insert({
          query: event.query,
          category: event.category || null,
          has_location: event.hasLocation,
          include_federated: event.includeFederated,
          total_results: event.totalResults,
          local_results: event.localResults,
          federated_results: event.federatedResults,
          query_time_ms: event.queryTimeMs,
          cache_hit: event.cacheHit,
          realtime_partners_queried: event.realtimePartnersQueried,
          realtime_partners_succeeded: event.realtimePartnersSucceeded,
          realtime_query_time_ms: event.realtimeQueryTimeMs,
          created_at: event.timestamp,
        })

        if (error) {
          console.error('Failed to record search metric:', error)
        }
      } catch (err) {
        console.error('Error recording search metric:', err)
      }
    },

    /**
     * Get aggregated metrics for a time window
     */
    async getAggregatedMetrics(
      timeWindow: string,
      startDate?: Date,
      endDate?: Date
    ): Promise<AggregatedMetrics> {
      try {
        let query = supabaseClient
          .from(TABLE_NAME)
          .select('*')
          .order('created_at', { ascending: false })

        if (startDate) {
          query = query.gte('created_at', startDate.toISOString())
        }
        if (endDate) {
          query = query.lte('created_at', endDate.toISOString())
        }

        const { data, error } = await query

        if (error) {
          console.error('Failed to fetch metrics:', error)
          return aggregateMetrics([], timeWindow)
        }

        if (!data || data.length === 0) {
          return aggregateMetrics([], timeWindow)
        }

        // Transform database records to SearchMetricEvent format
        const events: SearchMetricEvent[] = data.map((record: Record<string, unknown>) => ({
          query: record.query as string,
          category: (record.category as string) || undefined,
          hasLocation: record.has_location as boolean,
          includeFederated: record.include_federated as boolean,
          totalResults: record.total_results as number,
          localResults: record.local_results as number,
          federatedResults: record.federated_results as number,
          queryTimeMs: record.query_time_ms as number,
          cacheHit: record.cache_hit as boolean,
          realtimePartnersQueried: record.realtime_partners_queried as number,
          realtimePartnersSucceeded: record.realtime_partners_succeeded as number,
          realtimeQueryTimeMs: record.realtime_query_time_ms as number,
          timestamp: record.created_at as string,
        }))

        return aggregateMetrics(events, timeWindow)
      } catch (err) {
        console.error('Error getting aggregated metrics:', err)
        return aggregateMetrics([], timeWindow)
      }
    },

    /**
     * Get recent search events
     */
    async getRecentSearches(limit: number = 50): Promise<SearchMetricEvent[]> {
      try {
        const { data, error } = await supabaseClient
          .from(TABLE_NAME)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit)

        if (error) {
          console.error('Failed to fetch recent searches:', error)
          return []
        }

        if (!data) return []

        return data.map((record: Record<string, unknown>) => ({
          query: record.query as string,
          category: (record.category as string) || undefined,
          hasLocation: record.has_location as boolean,
          includeFederated: record.include_federated as boolean,
          totalResults: record.total_results as number,
          localResults: record.local_results as number,
          federatedResults: record.federated_results as number,
          queryTimeMs: record.query_time_ms as number,
          cacheHit: record.cache_hit as boolean,
          realtimePartnersQueried: record.realtime_partners_queried as number,
          realtimePartnersSucceeded: record.realtime_partners_succeeded as number,
          realtimeQueryTimeMs: record.realtime_query_time_ms as number,
          timestamp: record.created_at as string,
        }))
      } catch (err) {
        console.error('Error getting recent searches:', err)
        return []
      }
    },

    /**
     * Get popular search queries within a time window
     */
    async getPopularQueries(
      limit: number = 10,
      timeWindowHours: number = 24
    ): Promise<Array<{ query: string; count: number }>> {
      try {
        const startDate = new Date()
        startDate.setHours(startDate.getHours() - timeWindowHours)

        const { data, error } = await supabaseClient
          .from(TABLE_NAME)
          .select('query')
          .gte('created_at', startDate.toISOString())

        if (error) {
          console.error('Failed to fetch popular queries:', error)
          return []
        }

        if (!data || data.length === 0) return []

        // Aggregate and count queries
        const queryMap = new Map<string, number>()
        data.forEach((record: { query: string }) => {
          const normalizedQuery = record.query.toLowerCase().trim()
          queryMap.set(normalizedQuery, (queryMap.get(normalizedQuery) || 0) + 1)
        })

        return Array.from(queryMap.entries())
          .map(([query, count]) => ({ query, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit)
      } catch (err) {
        console.error('Error getting popular queries:', err)
        return []
      }
    },

    /**
     * Get partner contribution statistics
     */
    async getPartnerContribution(
      timeWindowHours: number = 24
    ): Promise<PartnerContribution[]> {
      try {
        const startDate = new Date()
        startDate.setHours(startDate.getHours() - timeWindowHours)

        // Query federated resources to get partner contribution
        const { data, error } = await supabaseClient
          .from('federated_resources')
          .select('source_instance_id, source_instance_name, created_at')
          .gte('created_at', startDate.toISOString())

        if (error) {
          console.error('Failed to fetch partner contribution:', error)
          return []
        }

        if (!data || data.length === 0) return []

        // Also fetch search metrics to calculate average response time per partner
        const { data: metricsData } = await supabaseClient
          .from(TABLE_NAME)
          .select('realtime_query_time_ms, realtime_partners_queried')
          .gte('created_at', startDate.toISOString())
          .gt('realtime_partners_queried', 0)

        // Calculate average response time (rough approximation)
        const avgResponseTime = metricsData && metricsData.length > 0
          ? metricsData.reduce((sum: number, m: any) => sum + m.realtime_query_time_ms, 0) / metricsData.length
          : 0

        // Group by partner
        const partnerMap = new Map<string, { name: string; count: number }>()
        data.forEach((record: any) => {
          const partnerId = record.source_instance_id
          const existing = partnerMap.get(partnerId)
          if (existing) {
            existing.count++
          } else {
            partnerMap.set(partnerId, {
              name: record.source_instance_name || partnerId,
              count: 1,
            })
          }
        })

        return Array.from(partnerMap.entries())
          .map(([partnerId, info]) => ({
            partnerId,
            partnerName: info.name,
            resourceCount: info.count,
            avgResponseTime: Math.round(avgResponseTime),
          }))
          .sort((a, b) => b.resourceCount - a.resourceCount)
      } catch (err) {
        console.error('Error getting partner contribution:', err)
        return []
      }
    },

    /**
     * Export metrics as CSV
     */
    async exportMetricsCsv(startDate: Date, endDate: Date): Promise<string> {
      try {
        const { data, error } = await supabaseClient
          .from(TABLE_NAME)
          .select('*')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Failed to export metrics:', error)
          return ''
        }

        if (!data || data.length === 0) {
          return 'timestamp,query,category,has_location,include_federated,total_results,local_results,federated_results,query_time_ms,cache_hit,realtime_partners_queried,realtime_partners_succeeded,realtime_query_time_ms\n'
        }

        // CSV header
        const headers = [
          'timestamp',
          'query',
          'category',
          'has_location',
          'include_federated',
          'total_results',
          'local_results',
          'federated_results',
          'query_time_ms',
          'cache_hit',
          'realtime_partners_queried',
          'realtime_partners_succeeded',
          'realtime_query_time_ms',
        ]

        const csvRows = [headers.join(',')]

        // CSV data rows
        data.forEach((record: any) => {
          const row = [
            record.created_at,
            `"${record.query.replace(/"/g, '""')}"`,
            record.category ? `"${record.category.replace(/"/g, '""')}"` : '',
            record.has_location,
            record.include_federated,
            record.total_results,
            record.local_results,
            record.federated_results,
            record.query_time_ms,
            record.cache_hit,
            record.realtime_partners_queried,
            record.realtime_partners_succeeded,
            record.realtime_query_time_ms,
          ]
          csvRows.push(row.join(','))
        })

        return csvRows.join('\n')
      } catch (err) {
        console.error('Error exporting metrics to CSV:', err)
        return ''
      }
    },
  }
}
