/**
 * Security Activity Component
 *
 * Displays user's recent audit log entries for security monitoring
 */

'use client'

import React, { useState, useEffect } from 'react'
import {
  Shield,
  Lock,
  Unlock,
  Eye,
  AlertCircle,
  ChevronDown,
  RefreshCw,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuditLog, type AuditLogEntry } from '@/hooks/use-audit-log'
import { formatDistanceToNow } from 'date-fns'

interface SecurityActivityProps {
  className?: string
}

export function SecurityActivity({ className = '' }: SecurityActivityProps) {
  const { logs, loading, error, hasMore, viewMyLogs, loadMore, refresh, clearError } = useAuditLog()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  // Load logs on mount
  useEffect(() => {
    viewMyLogs({ limit: 20 })
  }, [])

  // Reload when filters change
  useEffect(() => {
    if (selectedCategory !== 'all' || selectedSeverity !== 'all') {
      viewMyLogs({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        severity: selectedSeverity === 'all' ? undefined : selectedSeverity,
        limit: 20,
      })
    }
  }, [selectedCategory, selectedSeverity])

  const toggleExpanded = (logId: string) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedLogs(newExpanded)
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-amber-600" />
      default:
        return <CheckCircle className="w-4 h-4 text-blue-600" />
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('unlock')) return <Unlock className="w-4 h-4" />
    if (eventType.includes('lock')) return <Lock className="w-4 h-4" />
    if (eventType.includes('view') || eventType.includes('read')) return <Eye className="w-4 h-4" />
    if (eventType.includes('mfa')) return <Shield className="w-4 h-4" />
    return <Shield className="w-4 h-4" />
  }

  const formatEventType = (eventType: string) => {
    return eventType
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">Security Activity</h3>
          <p className="text-sm text-stone-500">Recent security events for your account</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-stone-600 mb-1 block">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          >
            <option value="all">All Categories</option>
            <option value="auth">Authentication</option>
            <option value="vault">Vault</option>
            <option value="encryption">Encryption</option>
            <option value="mfa">MFA</option>
            <option value="document">Documents</option>
            <option value="profile">Profile</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-stone-600 mb-1 block">Severity</label>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-900">{error}</p>
            <button onClick={clearError} className="text-xs text-red-700 underline mt-1">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && logs.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      )}

      {/* Empty State */}
      {!loading && logs.length === 0 && (
        <div className="text-center py-12 bg-stone-50 rounded-lg border border-stone-200">
          <Shield className="w-12 h-12 text-stone-400 mx-auto mb-3" />
          <p className="text-stone-600 font-medium">No security events found</p>
          <p className="text-sm text-stone-500 mt-1">
            Security events will appear here as you use the platform
          </p>
        </div>
      )}

      {/* Audit Log Entries */}
      {logs.length > 0 && (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-white rounded-lg border border-stone-200 hover:border-stone-300 transition-colors"
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleExpanded(log.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Event Icon */}
                  <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                    {getEventIcon(log.eventType)}
                  </div>

                  {/* Event Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-stone-900 text-sm">
                        {formatEventType(log.eventType)}
                      </h4>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${getSeverityBadge(
                          log.severity
                        )}`}
                      >
                        {log.severity}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                        {log.eventCategory}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <Clock className="w-3 h-3" />
                      <span>
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </span>
                      {log.resourceType && (
                        <>
                          <span>•</span>
                          <span>{log.action}</span>
                          <span>•</span>
                          <span>{log.resourceType}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Severity Icon */}
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(log.severity)}
                    <ChevronDown
                      className={`w-4 h-4 text-stone-400 transition-transform ${
                        expandedLogs.has(log.id) ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedLogs.has(log.id) && (
                  <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-stone-500">Action:</span>
                        <span className="ml-2 font-medium text-stone-900">{log.action}</span>
                      </div>
                      {log.sessionId && (
                        <div>
                          <span className="text-stone-500">Session:</span>
                          <span className="ml-2 font-mono text-stone-900">
                            {log.sessionId.substring(0, 8)}...
                          </span>
                        </div>
                      )}
                      {log.ipAddress != null && (
                        <div>
                          <span className="text-stone-500">IP Address:</span>
                          <span className="ml-2 font-mono text-stone-900">{String(log.ipAddress)}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-stone-500">Timestamp:</span>
                        <span className="ml-2 text-stone-900">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-stone-500 block mb-1">Additional Details:</span>
                        <pre className="text-xs bg-stone-50 p-2 rounded border border-stone-200 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <Button variant="outline" onClick={loadMore} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </Button>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">About Security Activity</p>
            <p className="text-blue-800">
              This log shows all security-relevant events for your account, including vault access,
              MFA verification, document access, and sensitive data views. These logs are immutable
              and cannot be deleted.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
