'use client'

/**
 * SafetyAlertsReview — admin post-hoc review of live safety alerts.
 *
 * Pins go live immediately (publish-then-review). Admins can set status='removed'
 * via the admin_remove_safety_alert SECDEF RPC (gated to is_staff=true at the DB level).
 *
 * Auth pattern mirrors moderation-queue.tsx: client-side Supabase call.
 * Logging: logger.info('pin.removed', { alertId }) on admin removal.
 */

import { useState, useCallback, useEffect } from 'react'
import { AlertTriangle, Cloud, Construction, Gauge, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LiveAlert {
  id: string
  alert_type: string
  severity: number
  description: string | null
  confirm_count: number
  clear_count: number
  created_at: string
  expires_at: string
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
  const [error, setError] = useState<string | null>(null)

  // Fetch live alerts for admin review
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data, error: fetchErr } = await supabase
          .from('safety_alerts')
          .select('id, alert_type, severity, description, confirm_count, clear_count, created_at, expires_at')
          .eq('status', 'live')
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

  const handleRemove = useCallback(
    async (alertId: string) => {
      setRemovingId(alertId)
      setError(null)
      try {
        const { error: rpcErr } = await supabase.rpc('admin_remove_safety_alert', {
          p_alert_id: alertId,
        })
        if (rpcErr) throw rpcErr
        setAlerts((prev) => prev.filter((a) => a.id !== alertId))
        logger.info('pin.removed', { alertId })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Remove failed')
      } finally {
        setRemovingId(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
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
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={removingId === alert.id}
                  onClick={() => handleRemove(alert.id)}
                  data-testid={`admin-remove-alert-${alert.id}`}
                >
                  {removingId === alert.id ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3 mr-1" />
                  )}
                  Remove alert
                </Button>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
