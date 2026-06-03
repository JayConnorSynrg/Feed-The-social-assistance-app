/**
 * Audit Log Hook
 *
 * React hook for audit logging and viewing audit history
 */

'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logAuditEvent, logPredefinedEvent, AUDIT_EVENTS, type AuditEvent } from '@/lib/audit-logger'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'
import type { AuditLogTable } from '@feed/database'

type AuditLogRow = AuditLogTable['Row']

export interface AuditLogEntry {
  id: string
  userId: string | null
  sessionId: string | null
  ipAddress: unknown
  userAgent: string | null
  eventType: string
  eventCategory: string
  severity: string
  resourceType: string | null
  resourceId: string | null
  action: string
  details: Record<string, unknown> | null
  createdAt: string
}

export interface UseAuditLogReturn {
  // Logging
  logEvent: (event: AuditEvent) => void
  logPredefined: typeof logPredefinedEvent

  // Viewing
  logs: AuditLogEntry[]
  loading: boolean
  error: string | null
  hasMore: boolean

  // Actions
  viewMyLogs: (options?: ViewLogsOptions) => Promise<void>
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
}

export interface ViewLogsOptions {
  category?: string
  severity?: string
  limit?: number
  offset?: number
}

const DEFAULT_LIMIT = 20

/**
 * Hook for audit logging and viewing audit history
 */
export function useAuditLog(): UseAuditLogReturn {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [currentOptions, setCurrentOptions] = useState<ViewLogsOptions>({})

  const supabase = createClient()

  /**
   * View user's own audit logs
   */
  const viewMyLogs = useCallback(
    async (options: ViewLogsOptions = {}) => {
      setLoading(true)
      setError(null)
      setCurrentOptions(options)

      try {
        const { category, severity, limit = DEFAULT_LIMIT, offset = 0 } = options

        let query = supabase
          .from('audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit)

        // Apply filters
        if (category) {
          query = query.eq('event_category', category)
        }

        if (severity) {
          query = query.eq('severity', severity)
        }

        const { data, error: fetchError } = await query.abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

        if (fetchError) {
          throw fetchError
        }

        const entries: AuditLogEntry[] = (data || []).map((row: AuditLogRow) => ({
          id: row.id,
          userId: row.user_id,
          sessionId: row.session_id,
          ipAddress: row.ip_address,
          userAgent: row.user_agent,
          eventType: row.event_type,
          eventCategory: row.event_category,
          severity: row.severity || 'info',
          resourceType: row.resource_type,
          resourceId: row.resource_id,
          action: row.action,
          details: row.details as Record<string, unknown> | null,
          createdAt: row.created_at,
        }))

        setLogs(entries)
        setHasMore(entries.length === limit + 1)
      } catch (err) {
        console.error('Failed to fetch audit logs:', err)
        setError(err instanceof Error ? err.message : 'Failed to load audit logs')
      } finally {
        setLoading(false)
      }
    },
    [supabase]
  )

  /**
   * Load more audit logs
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return

    const newOffset = logs.length

    setLoading(true)

    try {
      const { category, severity, limit = DEFAULT_LIMIT } = currentOptions

      let query = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(newOffset, newOffset + limit)

      if (category) {
        query = query.eq('event_category', category)
      }

      if (severity) {
        query = query.eq('severity', severity)
      }

      const { data, error: fetchError } = await query.abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (fetchError) {
        throw fetchError
      }

      const entries: AuditLogEntry[] = (data || []).map((row: AuditLogRow) => ({
        id: row.id,
        userId: row.user_id,
        sessionId: row.session_id,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        eventType: row.event_type,
        eventCategory: row.event_category,
        severity: row.severity || 'info',
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        action: row.action,
        details: row.details as Record<string, unknown> | null,
        createdAt: row.created_at,
      }))

      setLogs([...logs, ...entries])
      setHasMore(entries.length === limit + 1)
    } catch (err) {
      console.error('Failed to load more audit logs:', err)
      setError(err instanceof Error ? err.message : 'Failed to load more logs')
    } finally {
      setLoading(false)
    }
  }, [logs, hasMore, loading, currentOptions, supabase])

  /**
   * Refresh audit logs
   */
  const refresh = useCallback(async () => {
    await viewMyLogs(currentOptions)
  }, [viewMyLogs, currentOptions])

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // Logging
    logEvent: logAuditEvent,
    logPredefined: logPredefinedEvent,

    // Viewing
    logs,
    loading,
    error,
    hasMore,

    // Actions
    viewMyLogs,
    loadMore,
    refresh,
    clearError,
  }
}

// Export event types for easy access
export { AUDIT_EVENTS }
