'use client'

// apps/web/src/components/feed/safety-strip.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The feed's safety-alert strip: at most five shown alerts (live first, then resolved for six hours),
// read by hooks/use-safety-strip.ts, in the viewer's language (lib/i18n-feed-alerts.ts). What an
// entry shows follows the server's verdict on its row (lib/safety-alert-live.ts), not the browser clock.
//
//  - Each alert is a button that opens the map on that alert. Its visible text is its name: type,
//    severity (as a word, never colour alone), its state — "Resolved" (and by which role),
//    "Unverified", or "No longer listed" — the member's description (its own direction and language,
//    printed as written), its age, and "Updated …".
//  - The reporter gets Update / Mark resolved / Withdraw on their own alert (the server's is_mine;
//    never for a guest — the viewer comes from useAuth here, not from a prop a panel could forget).
//    Everyone gets History once an alert has changed. A resolved alert takes no update and no second
//    resolve; it can still be withdrawn. Each button is described by its entry's title, text and age,
//    so five entries of one type stay distinguishable.
//  - Community moderators and up also get "Edit in admin" beside the alert (a sibling, never inside
//    the button): /moderation?tab=moderation&focus=safety_alert:<id>.
//  - Two live regions, mounted from the first render and empty until something happens:
//      role="alert"   a newly reported alert, or one whose severity rose;
//      role="status"  everything else — an update, a resolution, an alert no longer listed, and the
//                     outcome of the member's own action.
//    A refresh that changes nothing changes neither region. Their text is cleared a few seconds
//    after it was spoken. The member's own outcome is also a visible line with a Dismiss control.
//  - An alert never leaves under the member: while focus or the pointer is inside an entry the store
//    keeps it (marked "No longer listed" once the server drops it) until they move on (onEngage).
//    The strip itself never moves focus when the list changes: an action button that has focus when
//    its action stops being offered (the alert ended, or someone resolved it) stays where it is,
//    marked disabled, until focus leaves it — so focus never falls to the page, and nobody reading
//    elsewhere with a screen reader has their place pulled back.
//  - Dismissing the visible outcome line takes its button away: focus goes to the strip's heading
//    first (the feed's heading when no alert is listed).

import { useRef, useState } from 'react'
import { CheckCircle2, ShieldAlert, X } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { relativeAge } from '@/lib/relative-age'
import { alertSeverityLabel, alertTypeLabel, alertUpdatedText, alertsT, stripEventText, type AlertMessages } from '@/lib/i18n-feed-alerts'
import { alertShownState } from '@/lib/safety-alert-live'
import type { SafetyAlert } from '@/lib/safety-alert-rpc'
import type { StripLive } from '@/hooks/use-safety-strip'
import { useAuth } from '@/hooks/use-auth'
import { ClientAdminEditLink } from '@/components/admin/client-admin-edit-link'
import { AlertTypeIcon, isHighSeverity, resolvedByText } from '@/components/alerts/alert-parts'
import type { AlertActionKind } from '@/components/alerts/alert-editor-dialog'

/**
 * The "Edit in admin" name of one strip alert: up to 5 alerts share 4 types, so the type alone
 * collides — add the age and the start of the description ("Road Closure, 5m ago: Bridge out on…").
 */
export function safetyStripItemName(label: string, description: string | null, age: string): string {
  const text = (description ?? '').replace(/\s+/g, ' ').trim()
  const start = text.length > 40 ? `${text.slice(0, 39)}…` : text
  return start ? `${label}, ${age}: ${start}` : `${label}, ${age}`
}

export type StripAction = AlertActionKind | 'history'

/** The actions one viewer gets on one alert. Owner actions need the server's is_mine and a member;
 *  what is possible follows the server's verdict on the row. */
export function stripActions(alert: SafetyAlert, viewer: { isGuest: boolean }): StripAction[] {
  const state = alertShownState(alert)
  if (state === 'gone') return []
  const actions: StripAction[] = []
  if (alert.is_mine && !viewer.isGuest) {
    if (state === 'live') actions.push('edit', 'resolve')
    actions.push('withdraw')
  }
  if (alert.version > 1) actions.push('history')
  return actions
}

const ACTION_LABEL: Record<StripAction, keyof AlertMessages> = {
  edit: 'actionUpdate',
  resolve: 'actionResolve',
  withdraw: 'actionWithdraw',
  history: 'actionHistory',
}

// border-stone-500! — important, because app/globals.css sets `* { border-color }` outside any
// cascade layer, which beats a plain border-colour utility (the edge would render pale grey).
export const ALERT_ACTION_BUTTON_CLASS =
  'inline-flex min-h-6 min-w-6 items-center justify-center rounded border border-stone-500! bg-white px-2 py-0.5 text-xs font-medium text-stone-800 ' +
  'hover:bg-stone-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 ' +
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:bg-white'

const ACTION_ORDER: readonly StripAction[] = ['edit', 'resolve', 'withdraw', 'history']

/**
 * The action buttons to draw for one alert: the actions on offer, plus the one that has focus right
 * now when it is no longer offered — drawn disabled until focus leaves it. Taking a focused button
 * out of the page drops focus to the document; putting focus somewhere else by script would move a
 * screen-reader user's reading position. Keeping the button does neither.
 */
export function actionsToDraw(offered: readonly StripAction[], focused: StripAction | null): Array<{ action: StripAction; disabled: boolean }> {
  return ACTION_ORDER.filter((action) => offered.includes(action) || action === focused).map((action) => ({ action, disabled: !offered.includes(action) }))
}

const QUIET: StripLive = { assertive: [], polite: [], spoken: '', notice: '', seq: 0 }

/** What holds an entry in place: keyboard focus inside it, or the pointer over it. */
type Hold = 'focus' | 'hover'

export interface SafetyStripProps {
  alerts: SafetyAlert[]
  locale?: Locale
  /** What the two live regions say, and the visible notice (hooks/use-safety-strip.ts). */
  live?: StripLive
  /** Open the map: on one alert (its entry), or as it is (the header link). */
  onViewMap: (alert?: SafetyAlert) => void
  /** Update / Mark resolved / Withdraw / History on an alert; `trigger` is the button (focus returns to it). */
  onAction?: (action: StripAction, alert: SafetyAlert, trigger: HTMLElement) => void
  /** Focus or the pointer entered (true) or left (false) an alert's entry. */
  onEngage?: (alertId: string, engaged: boolean) => void
  /** The member dismissed the visible notice. */
  onDismissNotice?: () => void
  /** Where focus goes after a dismissal when the strip lists no alert (it has no heading then). */
  focusFallback?: () => void
  /** The clock for ages: the instant of the last change to `alerts` (hooks/use-safety-strip.ts). */
  now?: number
  tz?: string
}

export function SafetyStrip({ alerts, locale = 'en', live = QUIET, onViewMap, onAction, onEngage, onDismissNotice, focusFallback, now, tz }: SafetyStripProps) {
  // A guest (anonymous session) gets no owner action.
  const { isAnonymous: isGuest } = useAuth()
  const [mountedAt] = useState(() => Date.now())
  const clock = now ?? mountedAt
  const t = (key: keyof AlertMessages) => alertsT(locale, key)
  const assertive = live.assertive.map((event) => stripEventText(locale, event)).join(' ')
  const polite = live.spoken || live.polite.map((event) => stripEventText(locale, event)).join(' ')

  // Which entries the member is on, and by what (an entry is released when nothing holds it).
  const holds = useRef(new Map<string, Set<Hold>>())
  const hold = (alertId: string, by: Hold, on: boolean) => {
    const set = holds.current.get(alertId) ?? new Set<Hold>()
    const was = set.size > 0
    if (on) set.add(by)
    else set.delete(by)
    holds.current.set(alertId, set)
    if (was !== set.size > 0) onEngage?.(alertId, set.size > 0)
  }

  // The action button that has focus right now (actionsToDraw keeps it while it does).
  const [focusedAction, setFocusedAction] = useState<{ alertId: string; action: StripAction } | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  return (
    <div data-testid="safety-strip-region">
      {/* Both regions exist before their first message, so the first one is announced. The keyed span
          makes a repeated sentence a new node (announced again); an unchanged one is left alone. */}
      <p role="alert" className="sr-only" data-testid="safety-strip-alert">
        {assertive && <span key={live.seq}>{assertive}</span>}
      </p>
      <p role="status" className="sr-only" data-testid="safety-strip-status">
        {polite && <span key={live.seq}>{polite}</span>}
      </p>
      {/* The member's own outcome, to read at leisure: not a live region (it was spoken above). */}
      {live.notice && (
        <div data-testid="safety-strip-notice" className="mb-2 flex items-start gap-2 rounded-md border border-stone-400 bg-stone-50 px-3 py-2 text-sm text-stone-800">
          <p className="min-w-0 flex-1">{live.notice}</p>
          <button
            type="button"
            aria-label={t('dismiss')}
            data-testid="safety-strip-notice-dismiss"
            onClick={(e) => {
              // This button is about to go. If it has focus, give focus a place first: the strip's
              // heading, or the feed's when no alert is listed. (A pointer press that left focus
              // elsewhere — Safari does not focus a clicked button — moves nothing.)
              if (document.activeElement === e.currentTarget) {
                if (headingRef.current) headingRef.current.focus()
                else focusFallback?.()
              }
              onDismissNotice?.()
            }}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-stone-700 hover:bg-stone-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {alerts.length > 0 && (
        <div data-testid="safety-strip" className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3
              ref={headingRef}
              tabIndex={-1}
              data-testid="safety-strip-heading"
              className="flex items-center gap-1.5 rounded text-xs font-semibold uppercase tracking-wide text-amber-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700"
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('stripTitle')}
            </h3>
            <button
              type="button"
              data-testid="safety-strip-view-map"
              onClick={() => onViewMap()}
              className="min-h-6 rounded-sm text-xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700"
            >
              {t('viewOnMap')}
            </button>
          </div>
          <ul className="space-y-2">
            {alerts.map((alert) => {
              const label = alertTypeLabel(alert.alert_type, locale)
              const state = alertShownState(alert)
              const high = isHighSeverity(alert.severity)
              const age = relativeAge(alert.created_at, locale, clock, tz)
              const titleId = `safety-strip-title-${alert.id}`
              const textId = `safety-strip-text-${alert.id}`
              const whenId = `safety-strip-when-${alert.id}`
              const stateId = `safety-strip-state-${alert.id}`
              const drawn = actionsToDraw(stripActions(alert, { isGuest }), focusedAction?.alertId === alert.id ? focusedAction.action : null)
              const resolvedBy = state === 'resolved' ? resolvedByText(alert.resolved_by_role, locale) : null
              return (
                <li
                  key={alert.id}
                  className="flex flex-col gap-1"
                  onFocus={() => hold(alert.id, 'focus', true)}
                  onBlur={(e) => {
                    const entry = e.currentTarget
                    if (e.relatedTarget) {
                      if (!entry.contains(e.relatedTarget as Node)) hold(alert.id, 'focus', false)
                      return
                    }
                    // Focus went nowhere: decide once the page has settled, so an entry that takes
                    // focus back stays held.
                    setTimeout(() => {
                      if (!entry.contains(document.activeElement)) hold(alert.id, 'focus', false)
                    }, 0)
                  }}
                  onMouseEnter={() => hold(alert.id, 'hover', true)}
                  onMouseLeave={() => hold(alert.id, 'hover', false)}
                >
                  <div className="flex items-start gap-2">
                    {/* A real button: its visible text (type, severity, state, description, age) is its name. */}
                    <button
                      type="button"
                      data-testid={`safety-strip-item-${alert.id}`}
                      className="group flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-md text-start focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700"
                      onClick={() => onViewMap(alert)}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          state !== 'live' ? 'bg-stone-200 text-stone-700' : high ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <AlertTypeIcon type={alert.alert_type} className="h-3 w-3" />
                      </span>
                      <span className="block min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span id={titleId} className={`text-xs font-semibold ${state !== 'live' ? 'text-stone-800' : high ? 'text-red-900' : 'text-amber-900'}`}>
                            {label}
                          </span>
                          <span
                            data-testid={`safety-strip-severity-${alert.id}`}
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${high ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}
                          >
                            {alertSeverityLabel(alert.severity, locale)}
                          </span>
                          {state === 'resolved' && (
                            <span id={`safety-strip-state-${alert.id}`} data-testid={`safety-strip-resolved-${alert.id}`} className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-900">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              {resolvedBy ?? t('stateResolved')}
                            </span>
                          )}
                          {state === 'gone' && (
                            <span id={`safety-strip-state-${alert.id}`} data-testid={`safety-strip-ended-${alert.id}`} className="rounded border border-stone-300 bg-stone-100 px-1.5 py-0.5 text-xs font-medium text-stone-800">
                              {t('stateEnded')}
                            </span>
                          )}
                          {state === 'live' && !alert.verified && <span className="text-xs text-stone-700">{t('stateUnverified')}</span>}
                        </span>
                        {alert.description && (
                          <span id={textId} className="mt-0.5 block text-xs text-stone-800 line-clamp-1" lang="" dir="auto">
                            {alert.description}
                          </span>
                        )}
                        <span id={whenId} className="mt-0.5 block text-xs text-stone-700">
                          {age}
                          {alert.updated_at && (
                            <>
                              {' · '}
                              <span data-testid={`safety-strip-updated-${alert.id}`}>
                                {alertUpdatedText(alert.updated_at, locale, clock, tz)}
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                    </button>
                    <ClientAdminEditLink
                      target={{ kind: 'safety_alert', id: alert.id }}
                      itemName={safetyStripItemName(label, alert.description, age)}
                      source="feed_alert"
                      locale={locale}
                      data-testid={`admin-edit-alert-${alert.id}`}
                    />
                  </div>
                  {drawn.length > 0 && (
                    <span className="ms-7 flex flex-wrap gap-1.5">
                      {drawn.map(({ action, disabled }) => (
                        <button
                          key={action}
                          type="button"
                          // Named by its visible text; the entry's title, text and age say which alert
                          // (five entries may share a type and these words). A button kept only because
                          // it has focus is disabled, and described by the alert's new state as well.
                          aria-describedby={[titleId, alert.description ? textId : '', whenId, disabled && state !== 'live' ? stateId : ''].filter(Boolean).join(' ')}
                          aria-disabled={disabled || undefined}
                          className={ALERT_ACTION_BUTTON_CLASS}
                          data-testid={`safety-strip-${action}-${alert.id}`}
                          onFocus={() => setFocusedAction({ alertId: alert.id, action })}
                          onBlur={() => setFocusedAction((held) => (held && held.alertId === alert.id && held.action === action ? null : held))}
                          onClick={(e) => {
                            if (!disabled) onAction?.(action, alert, e.currentTarget)
                          }}
                        >
                          {t(ACTION_LABEL[action])}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
