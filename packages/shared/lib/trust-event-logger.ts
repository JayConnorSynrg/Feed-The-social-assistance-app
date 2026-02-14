/**
 * Trust Event Logger
 *
 * Logs all trust score changes with an audit trail for transparency
 * and debugging trust-related issues.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type TrustEventType =
  | 'health_check_success'
  | 'health_check_failure'
  | 'sync_success'
  | 'sync_failure'
  | 'data_quality_update'
  | 'spam_report'
  | 'user_complaint'
  | 'abuse_detected'
  | 'manual_boost'
  | 'manual_penalty'
  | 'level_promotion'
  | 'level_demotion'
  | 'federation_enabled'
  | 'federation_disabled'
  | 'instance_suspended'
  | 'instance_blocked'
  | 'instance_restored'

export interface TrustEvent {
  id?: string
  peer_id: string
  event_type: TrustEventType
  old_score: number
  new_score: number
  old_level?: string
  new_level?: string
  reason: string
  metadata?: Record<string, unknown>
  created_by: string
  created_at?: string
}

export interface TrustEventQuery {
  peer_id?: string
  event_type?: TrustEventType | TrustEventType[]
  from_date?: Date
  to_date?: Date
  created_by?: string
  min_score_change?: number
  limit?: number
  offset?: number
}

export interface TrustEventSummary {
  totalEvents: number
  positiveEvents: number
  negativeEvents: number
  netScoreChange: number
  eventsByType: Record<string, number>
  periodStart: Date
  periodEnd: Date
}

/**
 * Create a trust event logger for a Supabase client
 */
export function createTrustEventLogger(supabase: SupabaseClient) {
  return {
    /**
     * Log a trust event
     */
    async logEvent(event: Omit<TrustEvent, 'id' | 'created_at'>): Promise<TrustEvent | null> {
      const { data, error } = await supabase
        .from('federation_trust_events')
        .insert({
          peer_id: event.peer_id,
          event_type: event.event_type,
          old_score: event.old_score,
          new_score: event.new_score,
          old_level: event.old_level,
          new_level: event.new_level,
          reason: event.reason,
          metadata: event.metadata || {},
          created_by: event.created_by,
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to log trust event:', error)
        return null
      }

      return data
    },

    /**
     * Query trust events with filters
     */
    async queryEvents(query: TrustEventQuery): Promise<TrustEvent[]> {
      let queryBuilder = supabase
        .from('federation_trust_events')
        .select('*')
        .order('created_at', { ascending: false })

      if (query.peer_id) {
        queryBuilder = queryBuilder.eq('peer_id', query.peer_id)
      }

      if (query.event_type) {
        if (Array.isArray(query.event_type)) {
          queryBuilder = queryBuilder.in('event_type', query.event_type)
        } else {
          queryBuilder = queryBuilder.eq('event_type', query.event_type)
        }
      }

      if (query.from_date) {
        queryBuilder = queryBuilder.gte('created_at', query.from_date.toISOString())
      }

      if (query.to_date) {
        queryBuilder = queryBuilder.lte('created_at', query.to_date.toISOString())
      }

      if (query.created_by) {
        queryBuilder = queryBuilder.eq('created_by', query.created_by)
      }

      if (query.limit) {
        queryBuilder = queryBuilder.limit(query.limit)
      }

      if (query.offset) {
        queryBuilder = queryBuilder.range(query.offset, query.offset + (query.limit || 50) - 1)
      }

      const { data, error } = await queryBuilder

      if (error) {
        console.error('Failed to query trust events:', error)
        return []
      }

      // Filter by min_score_change if specified
      if (query.min_score_change && data) {
        return data.filter(
          (e) => Math.abs(e.new_score - e.old_score) >= (query.min_score_change || 0)
        )
      }

      return data || []
    },

    /**
     * Get events for a specific peer
     */
    async getEventsForPeer(peerId: string, limit: number = 50): Promise<TrustEvent[]> {
      return this.queryEvents({ peer_id: peerId, limit })
    },

    /**
     * Get recent events across all peers
     */
    async getRecentEvents(limit: number = 100): Promise<TrustEvent[]> {
      return this.queryEvents({ limit })
    },

    /**
     * Get events summary for a peer
     */
    async getEventSummary(
      peerId: string,
      days: number = 30
    ): Promise<TrustEventSummary> {
      const periodEnd = new Date()
      const periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000)

      const events = await this.queryEvents({
        peer_id: peerId,
        from_date: periodStart,
        to_date: periodEnd,
        limit: 1000,
      })

      const eventsByType: Record<string, number> = {}
      let positiveEvents = 0
      let negativeEvents = 0
      let netScoreChange = 0

      for (const event of events) {
        // Count by type
        eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1

        // Calculate score changes
        const scoreChange = event.new_score - event.old_score
        netScoreChange += scoreChange

        if (scoreChange > 0) {
          positiveEvents++
        } else if (scoreChange < 0) {
          negativeEvents++
        }
      }

      return {
        totalEvents: events.length,
        positiveEvents,
        negativeEvents,
        netScoreChange: Math.round(netScoreChange * 1000) / 1000,
        eventsByType,
        periodStart,
        periodEnd,
      }
    },

    /**
     * Log a level change event
     */
    async logLevelChange(
      peerId: string,
      oldLevel: string,
      newLevel: string,
      oldScore: number,
      newScore: number,
      reason: string,
      createdBy: string = 'system'
    ): Promise<TrustEvent | null> {
      const eventType: TrustEventType =
        getLevelIndex(newLevel) > getLevelIndex(oldLevel) ? 'level_promotion' : 'level_demotion'

      return this.logEvent({
        peer_id: peerId,
        event_type: eventType,
        old_score: oldScore,
        new_score: newScore,
        old_level: oldLevel,
        new_level: newLevel,
        reason,
        metadata: { level_change: true },
        created_by: createdBy,
      })
    },

    /**
     * Log a manual admin action
     */
    async logAdminAction(
      peerId: string,
      action: 'manual_boost' | 'manual_penalty',
      oldScore: number,
      newScore: number,
      reason: string,
      adminId: string
    ): Promise<TrustEvent | null> {
      return this.logEvent({
        peer_id: peerId,
        event_type: action,
        old_score: oldScore,
        new_score: newScore,
        reason,
        metadata: { admin_action: true, admin_id: adminId },
        created_by: adminId,
      })
    },

    /**
     * Get significant events (large score changes)
     */
    async getSignificantEvents(
      peerId: string,
      threshold: number = 0.05,
      limit: number = 20
    ): Promise<TrustEvent[]> {
      return this.queryEvents({
        peer_id: peerId,
        min_score_change: threshold,
        limit,
      })
    },
  }
}

// Helper function to get level index for comparison
function getLevelIndex(level: string): number {
  const levels = ['untrusted', 'pending', 'trusted', 'verified', 'core']
  return levels.indexOf(level)
}

/**
 * Format a trust event for display
 */
export function formatTrustEvent(event: TrustEvent): string {
  const scoreChange = event.new_score - event.old_score
  const changeSymbol = scoreChange > 0 ? '+' : ''
  const changePercent = Math.round(scoreChange * 100 * 10) / 10

  return `${event.event_type}: ${changeSymbol}${changePercent}% (${event.reason})`
}

/**
 * Get event type category
 */
export function getEventCategory(
  eventType: TrustEventType
): 'health' | 'sync' | 'quality' | 'moderation' | 'admin' | 'status' {
  if (eventType.includes('health_check')) return 'health'
  if (eventType.includes('sync')) return 'sync'
  if (eventType.includes('data_quality')) return 'quality'
  if (
    eventType.includes('spam') ||
    eventType.includes('complaint') ||
    eventType.includes('abuse')
  )
    return 'moderation'
  if (eventType.includes('manual') || eventType.includes('level')) return 'admin'
  return 'status'
}

/**
 * Get event severity
 */
export function getEventSeverity(event: TrustEvent): 'low' | 'medium' | 'high' {
  const change = Math.abs(event.new_score - event.old_score)

  if (change >= 0.1) return 'high'
  if (change >= 0.02) return 'medium'
  return 'low'
}
