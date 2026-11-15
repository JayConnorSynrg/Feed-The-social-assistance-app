'use client'

/**
 * SafetyAlertsReview — admin post-hoc review of the safety alerts members can see: live ones, and
 * resolved ones for six hours. What is live and what is resolved is the server's verdict on each
 * row (lib/safety-alert-live.ts); the browser clock decides nothing here.
 *
 * Pins go live immediately (publish-then-review). A moderator verifies an alert (admin_verify_safety_alert)
 * or removes it (admin_remove_safety_alert); both are SECURITY DEFINER RPCs gated to moderators at the
 * DB level, both send the version the row was showing, and both answer the alert as members see it.
 *
 * The list is read through the one alert reader (lib/safety-alert-rpc.ts readSafetyAlertList), so it
 * shows exactly what the strip and the map show, with the server's is_mine:
 *   - a resolved alert is labelled "Resolved", is never counted as live and cannot be verified;
 *   - no self-moderation: a moderator gets no Approve on an alert they reported (the server refuses
 *     it with self_moderation_refused; the button is not offered).
 * A stale version (someone changed the alert first), an alert that ended, and a refused action each
 * say what happened and re-read the list; nothing is sent again on its own. A write that never
 * answers gives up after 12 s and says the action failed.
 *
 * Copy is English. The type and severity names come from the alert dictionary
 * (lib/i18n-feed-alerts.ts, read with 'en'), the same source the member surfaces use.
 *
 * Each row offers "View on map" (/#map?focus=safety_alert:<id>, opened in the reused feed-preview
 * tab) while the members' map shows the pin (safetyAlertMapVisibility — the same shown rule).
 * SafetyAlertsReviewView is the stateless rendering (tested with react-dom/server).
 *
 * "Edit in admin" on an alert (/moderation?tab=moderation&focus=safety_alert:<id>) opens this sub-tab
 * with that alert read by id and pinned at the top (marked "Opened from link"), once, even when it is
 * beyond the list. Only a shown alert can be read, so a removed, withdrawn, cleared or expired one is
 * not_found and says so. One admin.deeplink.resolve row per link (use-admin-focus.ts).
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { CheckCircle2, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { privilegedRpc } from '@/lib/privileged-action'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'
import { MemberViewLink } from '@/components/admin/member-view-link'
import { adminNavT } from '@/lib/i18n-admin-nav'
import { alertName, alertSeverityLabel, alertTypeLabel } from '@/lib/i18n-feed-alerts'
import { safetyAlertMapVisibility } from '@/lib/member-visibility'
import { alertShownState, isAlertLive } from '@/lib/safety-alert-live'
import {
  AlertReadError,
  parseAlertRpcError,
  readSafetyAlertById,
  readSafetyAlertList,
  toSafetyAlert,
  type AlertRpcError,
  type AlertRpcFailure,
  type SafetyAlert,
} from '@/lib/safety-alert-rpc'
import { mergeAlertAnswer } from '@/lib/safety-alert-store'
import { AlertTypeIcon } from '@/components/alerts/alert-parts'
import { useAdminFocusSession } from './use-admin-focus'
import { DESTRUCTIVE_BUTTON_CLASS } from './post-moderation-actions'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** An alert in the review list: exactly what the reader returns (live or resolved). */
export type ReviewAlert = SafetyAlert

/** The linked alert, read by id while it is shown: found, not_found (removed, withdrawn, cleared,
 *  expired or no such alert — none of them is readable), or error. */
export async function loadFocusedAlert(
  supabase: SupabaseClient<Database>,
  alertId: string,
): Promise<{ status: 'found'; alert: ReviewAlert } | { status: 'not_found' } | { status: 'error' }> {
  try {
    const alert = await readSafetyAlertById(supabase, alertId)
    return alert ? { status: 'found', alert } : { status: 'not_found' }
  } catch (err) {
    logger.warn('admin.deeplink.load_failed', { kind: 'safety_alert', code: err instanceof AlertReadError && err.code ? err.code : 'exception' })
    return { status: 'error' }
  }
}

/** The list with the linked alert first (once — not repeated where the list also has it). */
export function pinFocusedAlert(alerts: ReviewAlert[], focused: ReviewAlert | null): ReviewAlert[] {
  if (!focused) return alerts
  return [focused, ...alerts.filter((a) => a.id !== focused.id)]
}

/** Review order: live alerts first, then resolved ones; newest first within each. */
export function sortForReview(alerts: readonly ReviewAlert[]): ReviewAlert[] {
  return [...alerts].sort((a, b) => {
    const live = Number(isAlertLive(b)) - Number(isAlertLive(a))
    return live !== 0 ? live : Date.parse(b.created_at) - Date.parse(a.created_at)
  })
}

type FocusedAlert =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'found'; alert: ReviewAlert }
  | { status: 'not_found' }
  | { status: 'error' }

/** The line shown above the list for a linked alert that is not pinned. */
export function focusedAlertNotice(focused: { status: string }): string | null {
  if (focused.status === 'not_found') return 'The linked safety alert is no longer live (it was removed, withdrawn or has expired).'
  if (focused.status === 'error') return 'The linked safety alert could not be loaded. The list below still works.'
  return null
}

/** Whether Approve is offered: a live, unverified alert that this moderator did not report. */
export function canVerifyAlert(alert: ReviewAlert): boolean {
  return isAlertLive(alert) && !alert.verified && !alert.is_mine
}

/** What a refused verify / remove says (never the server's text). `reread`: read the list again. */
export function moderationFailure(action: 'verify' | 'remove', failure: AlertRpcFailure): { message: string; reread: boolean } {
  switch (failure.kind) {
    case 'conflict':
      return { message: 'This alert changed since the list was loaded. The list was refreshed: check the alert and try again.', reread: true }
    case 'not_live':
    case 'not_found':
      return { message: 'This alert is no longer live. The list was refreshed.', reread: true }
    case 'forbidden':
      return failure.token === 'self_moderation_refused'
        ? { message: 'You reported this alert, so another moderator has to verify it.', reread: false }
        : { message: 'You do not have permission to do this.', reread: false }
    default:
      return { message: action === 'verify' ? 'Approve failed' : 'Remove failed', reread: false }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SafetyAlertsReview() {
  const supabase = createClient()
  const [alerts, setAlerts] = useState<ReviewAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The clock the list was read with (the map-visibility check uses the same instant).
  const [loadedAt, setLoadedAt] = useState(() => new Date())
  // "Edit in admin" on an alert: read it by id and pin it.
  const session = useAdminFocusSession('safety_alert', 'moderation')
  const [focused, setFocused] = useState<FocusedAlert>({ status: 'none' })

  // Keyed on the linked alert's id (a string), not on the session object.
  const focusId = session?.focus.id ?? null
  useEffect(() => {
    if (!session || !focusId) return
    let active = true
    setFocused({ status: 'loading' })
    void loadFocusedAlert(supabase, focusId).then((res) => {
      if (!active) return
      session.resolve(res.status === 'found' ? 'found' : 'not_found')
      setFocused(res)
    })
    return () => {
      active = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId])

  // The list is read once on mount and once more each time `reads` moves (a refused action found the
  // list stale). The effect is keyed on that number, never on a function's identity, so a re-render
  // cannot read again.
  const [reads, setReads] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadedAt(new Date())
    readSafetyAlertList(supabase).then(
      (rows) => {
        if (!active) return
        setAlerts(sortForReview(rows))
        setLoading(false)
      },
      () => {
        if (!active) return
        setError('Failed to load alerts')
        setLoading(false)
      },
    )
    return () => {
      active = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reads])

  /** A refused action: say what happened; re-read when the list is stale. Nothing is sent again. The refusal's one
   *  app_logs row is privilegedRpc's error row (error_code, action, target_id, request_id); nothing is logged here. */
  const refused = useCallback(
    (action: 'verify' | 'remove', rpcErr: AlertRpcError) => {
      const { message, reread } = moderationFailure(action, parseAlertRpcError(rpcErr))
      setError(message)
      if (reread) {
        setFocused((f) => (f.status === 'found' ? { status: 'none' } : f))
        setReads((n) => n + 1)
      }
    },
    []
  )

  const handleApprove = useCallback(
    async (alert: ReviewAlert) => {
      setApprovingId(alert.id)
      setError(null)
      try {
        const { data, error: rpcErr, requestId } = await privilegedRpc(
          supabase,
          'admin.safety_alert.verify',
          'admin_verify_safety_alert',
          { p_alert_id: alert.id, p_expected_version: alert.version },
          { action: 'safety_alert.verify', target_id: alert.id },
          AbortSignal.timeout(QUERY_TIMEOUT_MS),
        )
        if (rpcErr) return refused('verify', rpcErr as AlertRpcError)
        // The answer is the alert as members see it; the row keeps its place and its is_mine.
        const answer = toSafetyAlert(data)
        const apply = (held: ReviewAlert): ReviewAlert => (answer ? mergeAlertAnswer(held, answer) : { ...held, verified: true })
        setAlerts((prev) => prev.map((a) => (a.id === alert.id ? apply(a) : a)))
        setFocused((f) => (f.status === 'found' && f.alert.id === alert.id ? { ...f, alert: apply(f.alert) } : f))
        logger.info('pin.verified', { alertId: alert.id, request_id: requestId })
      } finally {
        setApprovingId(null)
      }
    },
    [supabase, refused]
  )

  const handleRemove = useCallback(
    async (alert: ReviewAlert) => {
      setRemovingId(alert.id)
      setError(null)
      try {
        const { error: rpcErr, requestId } = await privilegedRpc(
          supabase,
          'admin.safety_alert.remove',
          'admin_remove_safety_alert',
          { p_alert_id: alert.id, p_expected_version: alert.version },
          { action: 'safety_alert.remove', target_id: alert.id },
          AbortSignal.timeout(QUERY_TIMEOUT_MS),
        )
        if (rpcErr) return refused('remove', rpcErr as AlertRpcError)
        setAlerts((prev) => prev.filter((a) => a.id !== alert.id))
        setFocused((f) => (f.status === 'found' && f.alert.id === alert.id ? { status: 'none' } : f))
        logger.info('pin.removed', { alertId: alert.id, request_id: requestId })
      } finally {
        setRemovingId(null)
      }
    },
    [supabase, refused]
  )

  const pinned = focused.status === 'found' ? focused.alert : null
  const shown = useMemo(() => pinFocusedAlert(alerts, pinned), [alerts, pinned])

  return (
    <SafetyAlertsReviewView
      alerts={shown}
      pinnedId={pinned?.id ?? null}
      focusNotice={focusedAlertNotice(focused)}
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
  alerts: ReviewAlert[]
  loading: boolean
  error: string | null
  approvingId: string | null
  removingId: string | null
  /** The clock the list was read with. */
  now: Date
  onApprove: (alert: ReviewAlert) => void
  onRemove: (alert: ReviewAlert) => void
  /** The alert an "Edit in admin" link opened (listed first, marked). */
  pinnedId?: string | null
  /** Why a linked alert is not pinned (no longer live / could not be loaded). */
  focusNotice?: string | null
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
  pinnedId = null,
  focusNotice = null,
}: SafetyAlertsReviewViewProps) {
  // ONE region for the linked alert's outcome, rendered in every state (before its text arrives), so
  // "no longer live" is announced when it appears.
  const focusRegion = (
    <p
      role="status"
      data-testid="focused-alert-notice"
      className={focusNotice ? 'mb-4 rounded-md border border-stone-300 bg-stone-50 p-3 text-sm text-stone-800' : 'sr-only'}
    >
      {focusNotice}
    </p>
  )

  const liveCount = alerts.filter((a) => isAlertLive(a)).length
  const resolvedCount = alerts.filter((a) => alertShownState(a) === 'resolved').length

  if (loading) {
    return (
      <>
        {focusRegion}
        <div role="status" className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
          {/* A live region announces its text content (an aria-label on it is not read out). */}
          <span className="sr-only">Loading safety alerts</span>
        </div>
      </>
    )
  }

  return (
    <>
    {focusRegion}
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Safety Alerts Review</h2>
        <span className="text-sm text-muted-foreground" data-testid="alert-review-count">
          {liveCount} live alert{liveCount !== 1 ? 's' : ''}
          {resolvedCount > 0 && ` · ${resolvedCount} resolved`}
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
            No safety alerts to review.
          </CardContent>
        </Card>
      ) : (
        alerts.map((alert) => {
          const isPinned = alert.id === pinnedId
          const resolved = alertShownState(alert) === 'resolved'
          return (
            <Card
              key={alert.id}
              data-testid={isPinned ? 'focused-alert' : undefined}
              className={isPinned ? 'border-2 border-lime-700' : undefined}
            >
              <CardHeader className="pb-2">
                {isPinned && (
                  <p className="mb-1 text-xs font-semibold text-lime-800">Opened from link</p>
                )}
                <div className="flex items-center gap-2">
                  <AlertTypeIcon type={alert.alert_type} className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <CardTitle className="text-base">
                    {alertTypeLabel(alert.alert_type, 'en')}
                  </CardTitle>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-medium">
                    {alertSeverityLabel(alert.severity, 'en')}
                  </span>
                  {resolved && (
                    <span className="text-xs px-2 py-0.5 rounded border border-green-300 bg-green-50 text-green-900 font-medium" data-testid={`admin-alert-resolved-${alert.id}`}>
                      Resolved
                    </span>
                  )}
                </div>
                <CardDescription className="text-xs">
                  Reported {formatDate(alert.created_at)}
                  {alert.updated_at && ` · Updated ${formatDate(alert.updated_at)}`}
                  {resolved && alert.resolved_at ? ` · Resolved ${formatDate(alert.resolved_at)}` : ` · Expires ${formatDate(alert.expires_at)}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {alert.description && (
                  <p lang="" dir="auto" className="text-sm text-stone-700 mb-3">{alert.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-stone-500 mb-3">
                  <span>{alert.confirm_count} still-here votes</span>
                  <span>·</span>
                  <span>{alert.clear_count} gone-now votes</span>
                </div>
                <div className="flex items-center gap-2">
                  {alert.verified && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-800 bg-green-50 border border-green-200 rounded px-2 py-1 font-medium">
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      Verified
                    </span>
                  )}
                  {!alert.verified && alert.is_mine && !resolved && (
                    <span className="text-xs text-stone-700" data-testid={`admin-own-alert-${alert.id}`}>
                      You reported this alert: another moderator verifies it.
                    </span>
                  )}
                  {canVerifyAlert(alert) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-300 text-green-700 hover:bg-green-50"
                      disabled={approvingId === alert.id}
                      onClick={() => onApprove(alert)}
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
                    className={DESTRUCTIVE_BUTTON_CLASS}
                    disabled={removingId === alert.id}
                    onClick={() => onRemove(alert)}
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
                    itemName={alertName(alert, 'en')}
                    source="safety_alerts"
                  />
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
    </>
  )
}
