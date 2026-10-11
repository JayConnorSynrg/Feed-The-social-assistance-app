'use client'

// apps/web/src/components/map/safety-alert-marker.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One safety alert on the members' map: an unclustered marker button and its popup, in the viewer's
// language (lib/i18n-feed-alerts.ts; the popup sets its own lang / dir, since a Mapbox popup would
// inherit the document's).
//
//  - The server's verdict on the row (lib/safety-alert-live.ts) decides what the popup offers: a live
//    alert takes "Still here" / "Gone now" votes; a resolved one shows "Resolved", by which role and
//    when, with no voting; an alert the server no longer shows while its popup is open says so and
//    offers nothing (focus moves to the popup itself, so Escape still closes it).
//  - Severity is a word in the popup and a shape + badge on the marker face (markerFace: colour only
//    repeats it). The marker's name and the popup carry their own lang / dir. The reported time is a
//    full date and time (an alert can live 72 hours), with "Updated …" and the expiry.
//  - A counted vote is announced once, politely ("Vote recorded.").
//  - The reporter (the server's is_mine, never a guest) gets Update / Mark resolved / Withdraw; they
//    open the alert dialog (components/alerts/alert-editor-dialog.tsx), which reads the alert afresh.
//    History is open to everyone once the alert has changed. Guests see counts, not vote buttons
//    (the viewer comes from useAuth here, not from a prop a panel could forget).
//  - A vote's answer is merged onto the pin by the hook (it keeps its place and this popup stays
//    open). An alert the member's own vote clears leaves at once: onEnded moves focus to the map
//    first, then the notice is announced.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Marker, Popup } from 'react-map-gl/mapbox'
import { CheckCircle2, Info, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/format-message'
import { alertFailureText, alertName, alertSeverityLabel, alertTypeLabel, alertUpdatedText, alertsT, type AlertMessages } from '@/lib/i18n-feed-alerts'
import { alertShownState, isAlertShown } from '@/lib/safety-alert-live'
import { useAuth } from '@/hooks/use-auth'
import type { AlertOutcome, AlertVote, SafetyAlert } from '@/lib/safety-alert-rpc'
import { MARKER_BUTTON_FOCUS, MarkerPopupDialog, markerA11yRef, useMarkerPopup } from './marker-popup'
import { ClientAdminEditLink } from '@/components/admin/client-admin-edit-link'
import { AlertTypeIcon, isHighSeverity, markerFace, resolvedByText } from '@/components/alerts/alert-parts'
import { formatAlertDateTime } from '@/components/alerts/alert-edit-model'
import { ALERT_ACTION_BUTTON_CLASS, stripActions, type StripAction } from '@/components/feed/safety-strip'

const ACTION_LABEL: Record<StripAction, keyof AlertMessages> = {
  edit: 'actionUpdate',
  resolve: 'actionResolve',
  withdraw: 'actionWithdraw',
  history: 'actionHistory',
}

interface SafetyAlertMarkerProps {
  alert: SafetyAlert
  locale?: Locale
  onVote: (alert: SafetyAlert, vote: AlertVote) => Promise<AlertOutcome<SafetyAlert>>
  /** Update / Mark resolved / Withdraw / History; `trigger` is the button (focus returns to it). */
  onAction?: (action: StripAction, alert: SafetyAlert, trigger: HTMLElement) => void
  /** This alert's popup opened (true) or closed (false): an alert never leaves under an open popup. */
  onEngage?: (alertId: string, engaged: boolean) => void
  /** The alert left because of what the member did here (their vote cleared it), or its popup was
   *  closed after it ended: move focus to the map, then announce `notice` (may be empty). */
  onEnded?: (notice: string) => void
  /** A followed map deep link landed on this pin: open its popup. */
  focused?: boolean
  /** The clock for ages: the instant of the last change to the alert list (hooks/use-safety-alerts.ts). */
  now?: number
  tz?: string
}

// SafetyAlertMarkerInner contains all hooks; called only when coords are valid.
function SafetyAlertMarkerInner({ alert, locale = 'en', onVote, onAction, onEngage, onEnded, focused, now, tz }: SafetyAlertMarkerProps) {
  // A guest (anonymous session) cannot vote or own an alert.
  const { isAnonymous: isGuest } = useAuth()
  // Opened by a click, or by a followed map deep link landing on this pin (#map?focus=…).
  const { open: showPopup, setOpen: setShowPopup, triggerRef, titleId, close, onPopupOpen } = useMarkerPopup(focused)
  const [voting, setVoting] = useState<AlertVote | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)
  // "Vote recorded." for the popup's polite region; `seq` makes a second vote a new message.
  const [voteNotice, setVoteNotice] = useState({ text: '', seq: 0 })
  const [mountedAt] = useState(() => Date.now())
  const clock = now ?? mountedAt
  const state = alertShownState(alert)
  const popupRef = useRef<HTMLDivElement>(null)
  const t = (key: keyof AlertMessages) => alertsT(locale, key)
  const alertId = alert.id

  // While the popup is open the store keeps this alert (marked "no longer listed" once it ends).
  useEffect(() => {
    if (!showPopup) return
    onEngage?.(alertId, true)
    return () => onEngage?.(alertId, false)
  }, [showPopup, alertId, onEngage])

  // The server dropped this alert while its popup is open: its buttons are gone. If one of them held
  // focus, focus has fallen to the page: it moves to the popup itself (its dialog container), so
  // Escape and Close still work. Focus that is anywhere else (on Close, in the search box) stays put.
  useEffect(() => {
    if (state !== 'gone' || !showPopup) return
    const active = document.activeElement
    const lost = !active || active === document.body
    if (lost) popupRef.current?.closest<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true })
  }, [state, showPopup])

  // Closing the popup of an ended alert takes its marker away: focus goes to the map, not the marker.
  const closePopup = useCallback(() => {
    if (state !== 'gone') return close()
    setShowPopup(false)
    onEnded?.('')
  }, [state, close, setShowPopup, onEnded])

  const handleVote = useCallback(
    async (vote: AlertVote) => {
      setVoting(vote)
      setVoteError(null)
      const res = await onVote(alert, vote)
      setVoting(null)
      if (res.ok) {
        // Three "Gone now" votes cleared it: the pin has left; focus first, then the notice.
        if (!isAlertShown(res.value)) onEnded?.(alertsT(locale, 'voteCleared'))
        // Otherwise the popup stays: say once that the vote was counted.
        else setVoteNotice((n) => ({ text: alertsT(locale, 'voteRecorded'), seq: n.seq + 1 }))
        return
      }
      if (res.failure.kind === 'not_live' || res.failure.kind === 'not_found') onEnded?.(alertFailureText(locale, res.failure))
      else setVoteError(res.failure.kind === 'guest' || res.failure.kind === 'network' ? alertFailureText(locale, res.failure) : alertsT(locale, 'voteFailed'))
    },
    [alert, onVote, onEnded, locale]
  )

  const high = isHighSeverity(alert.severity)
  const typeLabel = alertTypeLabel(alert.alert_type, locale)
  const severityLabel = alertSeverityLabel(alert.severity, locale)
  const actions = stripActions(alert, { isGuest })
  const face = markerFace(state, alert.severity)
  const resolvedBy = state === 'resolved' ? resolvedByText(alert.resolved_by_role, locale) : null
  // The marker's name: type and severity; a resolved or ended alert says so instead of its severity.
  const markerName =
    state === 'live'
      ? alertName(alert, locale)
      : formatMessage(t('typeAndSeverity'), { type: typeLabel, severity: t(state === 'resolved' ? 'stateResolved' : 'stateEnded') })

  return (
    <>
      <Marker ref={markerA11yRef}
        longitude={alert.lng}
        latitude={alert.lat}
        anchor="bottom"
        onClick={(e) => {
          e.originalEvent.stopPropagation()
          setShowPopup(true)
        }}
      >
        <button
          type="button"
          ref={triggerRef}
          lang={locale}
          dir={dir(locale)}
          className={cn(
            'relative flex items-center justify-center w-8 h-8 border-2 cursor-pointer shadow-md transition-transform hover:scale-110',
            // Shape, badge, check mark and a hollow face carry severity and state; colour repeats them.
            face.shape === 'square' ? 'rounded-md' : 'rounded-full',
            MARKER_BUTTON_FOCUS,
            face.hollow
              ? 'bg-white border-dashed border-stone-700 text-stone-800'
              : state !== 'live'
                ? 'bg-stone-600 border-stone-800 text-white'
                : high
                  ? 'bg-red-700 border-red-900 text-white'
                  : 'bg-amber-700 border-amber-900 text-white'
          )}
          aria-label={markerName}
          aria-haspopup="dialog"
          aria-expanded={showPopup}
          data-testid={`safety-alert-marker-${alert.id}`}
          data-face={`${face.shape}${face.badge ? `:${face.badge}` : ''}${face.check ? ':check' : ''}${face.hollow ? ':hollow' : ''}`}
        >
          {face.check ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <AlertTypeIcon type={alert.alert_type} className="w-4 h-4" />}
          {face.badge && (
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -end-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-red-900 bg-white px-0.5 text-[10px] font-bold leading-none text-red-900"
            >
              {face.badge}
            </span>
          )}
        </button>
      </Marker>

      {showPopup && (
        <Popup
          longitude={alert.lng}
          latitude={alert.lat}
          anchor="bottom"
          offset={40}
          onClose={closePopup}
          onOpen={onPopupOpen}
          focusAfterOpen={false}
          closeButton={false}
          closeOnClick={false}
          maxWidth="300px"
        >
          <MarkerPopupDialog titleId={titleId} onClose={closePopup} closeLabel={t('close')} lang={locale} dir={dir(locale)} className="p-2 text-stone-900">
            <div ref={popupRef} data-testid={`safety-alert-popup-${alert.id}`}>
              {/* The member's own vote was counted: said once, politely (mounted with the popup). */}
              <p role="status" className="sr-only" data-testid={`alert-vote-status-${alert.id}`}>
                {voteNotice.text && <span key={voteNotice.seq}>{voteNotice.text}</span>}
              </p>
              {/* State: verified / unverified while live; resolved; no longer listed. Always a word. */}
              {state === 'live' && alert.verified && (
                <p className="mb-2 inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs text-green-900">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {t('stateVerified')}
                </p>
              )}
              {state === 'live' && !alert.verified && (
                <p className="mb-2 inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
                  <Info className="h-3 w-3" aria-hidden="true" />
                  {t('stateUnverified')}
                </p>
              )}
              {state === 'resolved' && (
                <p className="mb-2 inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-900" data-testid={`alert-resolved-${alert.id}`}>
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {resolvedBy ?? t('stateResolved')}
                </p>
              )}
              {state === 'gone' && (
                <p className="mb-2 rounded border border-stone-300 bg-stone-100 px-2 py-1 text-xs text-stone-800" data-testid={`alert-ended-${alert.id}`}>
                  {t('endedBody')}
                </p>
              )}

              {/* Title + severity */}
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <AlertTypeIcon type={alert.alert_type} className={cn('h-4 w-4 shrink-0', state !== 'live' ? 'text-stone-600' : high ? 'text-red-700' : 'text-amber-700')} />
                <span id={titleId} className="text-sm font-semibold">{typeLabel}</span>
                <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', high ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900')}>
                  {severityLabel}
                </span>
              </div>

              {/* Description: the member's own words, in their own direction. */}
              {alert.description && (
                <p lang="" dir="auto" className="mb-3 text-xs leading-relaxed text-stone-800">{alert.description}</p>
              )}

              {state === 'live' && (
                <>
                  <p className="mb-3 flex flex-wrap items-center gap-x-3 text-xs text-stone-700">
                    <span>{formatMessage(t('countConfirmed'), { n: alert.confirm_count })}</span>
                    <span>{formatMessage(t('countGone'), { n: alert.clear_count })}</span>
                  </p>
                  {voteError && (
                    <p role="alert" className="mb-2 text-xs text-red-800">{voteError}</p>
                  )}
                  {isGuest ? (
                    <p className="text-xs text-stone-700" data-testid={`alert-guest-hint-${alert.id}`}>{t('guestHint')}</p>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 flex-1 border-amber-400 text-xs text-amber-900 hover:bg-amber-50"
                        aria-disabled={voting !== null || undefined}
                        onClick={() => {
                          if (voting === null) void handleVote('confirm')
                        }}
                        data-testid={`vote-confirm-${alert.id}`}
                      >
                        <ThumbsUp className="me-1 h-3 w-3" aria-hidden="true" />
                        {voting === 'confirm' ? t('voteSending') : t('voteStillHere')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 flex-1 border-stone-400 text-xs text-stone-800 hover:bg-stone-50"
                        aria-disabled={voting !== null || undefined}
                        onClick={() => {
                          if (voting === null) void handleVote('clear')
                        }}
                        data-testid={`vote-clear-${alert.id}`}
                      >
                        <ThumbsDown className="me-1 h-3 w-3" aria-hidden="true" />
                        {voting === 'clear' ? t('voteSending') : t('voteGone')}
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* When: reported (date and time), updated, and when it ends. */}
              <p className="mt-2 text-xs text-stone-700" data-testid={`alert-times-${alert.id}`}>
                <span className="block">{formatMessage(t('reportedAt'), { when: formatAlertDateTime(alert.created_at, locale, tz) })}</span>
                {alert.updated_at && (
                  <span className="block" data-testid={`alert-updated-${alert.id}`}>
                    {alertUpdatedText(alert.updated_at, locale, clock, tz)}
                  </span>
                )}
                {state === 'live' && <span className="block">{formatMessage(t('expiresAt'), { when: formatAlertDateTime(alert.expires_at, locale, tz) })}</span>}
                {state === 'resolved' && alert.resolved_at && (
                  <span className="block">{formatMessage(t('resolvedAt'), { when: formatAlertDateTime(alert.resolved_at, locale, tz) })}</span>
                )}
              </p>

              {/* "Edit in admin" (moderators and up): the alert pinned in the Safety Alerts review. Inside
                  the popup dialog, so Tab reaches it and Escape still closes the popup. */}
              <div className="mt-2 empty:hidden">
                <ClientAdminEditLink
                  target={{ kind: 'safety_alert', id: alert.id }}
                  itemName={alertName(alert, locale)}
                  source="map_popup"
                  locale={locale}
                  data-testid={`admin-edit-alert-${alert.id}`}
                />
              </div>

              {/* History for everyone once the alert has changed; the reporter's own actions. */}
              {actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-stone-200 pt-2">
                  {actions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      className={ALERT_ACTION_BUTTON_CLASS}
                      data-testid={`${action}-alert-${alert.id}`}
                      onClick={(e) => onAction?.(action, alert, e.currentTarget)}
                    >
                      {t(ACTION_LABEL[action])}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </MarkerPopupDialog>
        </Popup>
      )}
    </>
  )
}

/**
 * SafetyAlertMarker — guards against NaN coordinates before rendering.
 * Mapbox GL throws synchronously on (NaN, NaN) which triggers PanelErrorBoundary. The store keeps a
 * pin's coordinates through every answer (lib/safety-alert-store.ts mergeAlertAnswer); this guard
 * stays so an alert that never had a place is not drawn.
 */
export function SafetyAlertMarker(props: SafetyAlertMarkerProps) {
  if (!isFinite(props.alert.lng) || !isFinite(props.alert.lat)) return null
  return <SafetyAlertMarkerInner {...props} />
}
