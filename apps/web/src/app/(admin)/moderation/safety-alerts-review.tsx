'use client'

/**
 * SafetyAlertsReview — admin post-hoc review of live safety alerts (status 'live'
 * and not yet past expires_at — see safety-alert-live.ts).
 *
 * Pins go live immediately (publish-then-review). Admins can set status='removed'
 * via the admin_remove_safety_alert SECDEF RPC (gated to is_staff=true at the DB level).
 *
 * Auth pattern mirrors moderation-queue.tsx: client-side Supabase call.
 * Logging: logger.info('pin.removed', { alertId }) on admin removal.
 *
 * Each row offers "View on map" (/#map?focus=safety_alert:<id>, opened in the reused feed-preview
 * tab) while the members' map shows the pin: safetyAlertMapVisibility, the safety_alerts_in_view
 * rule. The list already holds only live, unexpired alerts, so today every row links; the predicate
 * stays so a list change can never hand an admin a link to a pin members do not see.
 * SafetyAlertsReviewView is the stateless rendering (tested with react-dom/server).
 */

import { useState, useCallback, useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Cloud, Construction, Gauge, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { privilegedRpc } from '@/lib/privileged-action'
import { MemberViewLink } from '@/components/admin/member-view-link'
import { adminNavT } from '@/lib/i18n-admin-nav'
import { safetyAlertMapVisibility } from '@/lib/member-visibility'
import { whereSafetyAlertLive } from './safety-alert-live'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveAlert {
  id: string
  status: string
  alert_type: string
  severity: number
  description: string | null
  confirm_count: number
  clear_count: number
  created_at: string
  expires_at: string
  verified: boolean
}

const ALERT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  weather: Cloud,
  road_closure: Construction,
  speeding: Gauge,
  general: AlertTriangle,
}

const ALERT_LABELS: Record<string, string> = {
  weather: 'Weather Hazard',
  road_closure: 'Road Closure',
  speeding: 'Speeding Area',
  general: 'Safety Alert',
}

const SEVERITY_LABELS: Record<number, string> = { 1: 'Low', 2: 'Moderate', 3: 'High', 4: 'Critical' }

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SafetyAlertsReview() {
  const supabase = createClient()
  const [alerts, setAlerts] = useState<LiveAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The clock the list was read with (the map-visibility check uses the same instant).
  const [loadedAt, setLoadedAt] = useState(() => new Date())

  // Fetch live alerts for admin review
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const now = new Date()
        setLoadedAt(now)
        const { data, error: fetchErr } = await whereSafetyAlertLive(
          supabase
            .from('safety_alerts')
            .select('id, status, alert_type, severity, description, confirm_count, clear_count, created_at, expires_at, verified'),
          now,
        )
          .order('created_at', { ascending: false })
          .limit(50)

        if (fetchErr) throw fetchErr
        setAlerts((data ?? []) as LiveAlert[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alerts')
      } finally {
        setLoading(false)
      }
    }
    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleApprove = useCallback(
    async (alertId: string) => {
      setApprovingId(alertId)
      setError(null)
      try {
        const { error: rpcErr, requestId } = await privilegedRpc(
          supabase,
          'admin.safety_alert.verify',
          'admin_verify_safety_alert',
          { p_alert_id: alertId },
          { action: 'safety_alert.verify', target_id: alertId },
        )
        if (rpcErr) {
          logger.warn('admin.denied', { action: 'safety_alert.verify', code: rpcErr.code ?? 'unknown', request_id: requestId })
          throw rpcErr
        }
        setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, verified: true } : a))
        logger.info('pin.verified', { alertId, request_id: requestId })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Approve failed')
      } finally {
        setApprovingId(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const handleRemove = useCallback(
    async (alertId: string) => {
      setRemovingId(alertId)
      setError(null)
      try {
        const { error: rpcErr, requestId } = await privilegedRpc(
          supabase,
          'admin.safety_alert.remove',
          'admin_remove_safety_alert',
          { p_alert_id: alertId },
          { action: 'safety_alert.remove', target_id: alertId },
        )
        if (rpcErr) {
          logger.warn('admin.denied', { action: 'safety_alert.remove', code: rpcErr.code ?? 'unknown', request_id: requestId })
          throw rpcErr
        }
        setAlerts((prev) => prev.filter((a) => a.id !== alertId))
        logger.info('pin.removed', { alertId, request_id: requestId })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Remove failed')
      } finally {
        setRemovingId(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return (
    <SafetyAlertsReviewView
      alerts={alerts}
      loading={loading}
      error={error}
      approvingId={approvingId}
      removingId={removingId}
      now={loadedAt}
      onApprove={handleApprove}
      onRemove={handleRemove}
    />
  )
}

export interface SafetyAlertsReviewViewProps {
  alerts: LiveAlert[]
  loading: boolean
  error: string | null
  approvingId: string | null
  removingId: string | null
  /** The clock the list was read with. */
  now: Date
  onApprove: (alertId: string) => void
  onRemove: (alertId: string) => void
}

const formatDate = (d: string) =>
  new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

/** The review list for one load state (stateless). */
export function SafetyAlertsReviewView({
  alerts,
  loading,
  error,
  approvingId,
  removingId,
  now,
  onApprove,
  onRemove,
}: SafetyAlertsReviewViewProps) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading safety alerts" className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Safety Alerts Review</h2>
        <span className="text-sm text-muted-foreground">
          {alerts.length} live alert{alerts.length !== 1 ? 's' : ''}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Pins are live immediately (publish-then-review). Remove alerts that violate community guidelines.
      </p>

      {error && (
        <div role="alert" className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No live safety alerts to review.
          </CardContent>
        </Card>
      ) : (
        alerts.map((alert) => {
          const Icon = ALERT_ICONS[alert.alert_type] ?? AlertTriangle
          return (
            <Card key={alert.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <CardTitle className="text-base">
                    {ALERT_LABELS[alert.alert_type] ?? alert.alert_type}
                  </CardTitle>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                    {SEVERITY_LABELS[alert.severity] ?? `Sev ${alert.severity}`}
                  </span>
                </div>
                <CardDescription className="text-xs">
                  Reported {formatDate(alert.created_at)} · Expires {formatDate(alert.expires_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {alert.description && (
                  <p className="text-sm text-stone-700 mb-3">{alert.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-stone-500 mb-3">
                  <span>{alert.confirm_count} still-here votes</span>
                  <span>·</span>
                  <span>{alert.clear_count} gone-now votes</span>
                </div>
                <div className="flex items-center gap-2">
                  {alert.verified ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-300 text-green-700 hover:bg-green-50"
                      disabled={approvingId === alert.id}
                      onClick={() => onApprove(alert.id)}
                      data-testid={`admin-approve-alert-${alert.id}`}
                    >
                      {approvingId === alert.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                      )}
                      Approve
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={removingId === alert.id}
                    onClick={() => onRemove(alert.id)}
                    data-testid={`admin-remove-alert-${alert.id}`}
                  >
                    {removingId === alert.id ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3 mr-1" />
                    )}
                    Remove alert
                  </Button>
                  <MemberViewLink
                    to={{ kind: 'map_focus', focus: { kind: 'safety_alert', id: alert.id } }}
                    visibility={safetyAlertMapVisibility(alert, now)}
                    label={adminNavT('en', 'viewOnMap')}
                    itemName={`${ALERT_LABELS[alert.alert_type] ?? alert.alert_type}, ${SEVERITY_LABELS[alert.severity] ?? `severity ${alert.severity}`}`}
                    source="safety_alerts"
                  />
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
