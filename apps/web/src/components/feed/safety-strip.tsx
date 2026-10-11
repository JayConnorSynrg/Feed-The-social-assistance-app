'use client'

// apps/web/src/components/feed/safety-strip.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The feed's safety-alert strip: at most five shown alerts (live first, then resolved for six hours),
// read by hooks/use-safety-strip.ts, in the viewer's language (lib/i18n-feed-alerts.ts).
//
//  - Each alert is a button that opens the map on that alert. Its visible text is its name: type,
//    severity (as a word, never colour alone), its state — "Resolved", "Unverified", or "No longer
//    listed" — the member's description (its own direction and language), its age, and "Updated …".
//  - The reporter gets Update / Mark resolved / Withdraw on their own alert (the server's is_mine;
//    never for a guest). Everyone gets History once an alert has changed. A resolved alert takes no
//    update and no second resolve; it can still be withdrawn.
//  - Community moderators and up also get "Edit in admin" beside the alert (a sibling, never inside
//    the button): /moderation?tab=moderation&focus=safety_alert:<id>.
//  - Two live regions, mounted from the first render and empty until something happens:
//      role="alert"   a new alert on the strip, or one whose severity rose;
//      role="status"  everything else — an update, a resolution, an alert no longer listed, and the
//                     outcome of the member's own action (shown as a line as well).
//    A refresh that changes nothing changes neither region, so nothing is announced.
//  - An alert never leaves under the member's focus: while focus is inside an entry the store keeps
//    it (marked "No longer listed") until focus moves on (onEngage).

import { useState } from 'react'
import { CheckCircle2, ShieldAlert } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { relativeAge } from '@/lib/relative-age'
import { alertSeverityLabel, alertTypeLabel, alertUpdatedText, alertsT, stripEventText, type AlertMessages } from '@/lib/i18n-feed-alerts'
import { alertShownState } from '@/lib/safety-alert-live'
import type { SafetyAlert } from '@/lib/safety-alert-rpc'
import type { StripLive } from '@/hooks/use-safety-strip'
import { ClientAdminEditLink } from '@/components/admin/client-admin-edit-link'
import { AlertTypeIcon, isHighSeverity } from '@/components/alerts/alert-parts'
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

/** The actions one viewer gets on one alert. Owner actions need the server's is_mine and a member. */
export function stripActions(alert: SafetyAlert, viewer: { isGuest: boolean }, now: number): StripAction[] {
  const state = alertShownState(alert, now)
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

export const ALERT_ACTION_BUTTON_CLASS =
  'inline-flex min-h-6 min-w-6 items-center justify-center rounded border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-800 ' +
  'hover:bg-stone-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700'

const QUIET: StripLive = { assertive: [], polite: [], notice: '', seq: 0 }

export interface SafetyStripProps {
  alerts: SafetyAlert[]
  locale?: Locale
  /** A guest (anonymous session) gets no owner action. */
  isGuest?: boolean
  /** What the two live regions say (hooks/use-safety-strip.ts). */
  live?: StripLive
  /** Open the map: on one alert (its entry), or as it is (the header link). */
  onViewMap: (alert?: SafetyAlert) => void
  /** Update / Mark resolved / Withdraw / History on an alert; `trigger` is the button (focus returns to it). */
  onAction?: (action: StripAction, alert: SafetyAlert, trigger: HTMLElement) => void
  /** Focus entered (true) or left (false) an alert's entry. */
  onEngage?: (alertId: string, engaged: boolean) => void
  /** The clock for ages and the shown rule: the instant of the last change to `alerts`
   *  (hooks/use-safety-strip.ts). */
  now?: number
  tz?: string
}

export function SafetyStrip({ alerts, locale = 'en', isGuest = false, live = QUIET, onViewMap, onAction, onEngage, now, tz }: SafetyStripProps) {
  const [mountedAt] = useState(() => Date.now())
  const clock = now ?? mountedAt
  const t = (key: keyof AlertMessages) => alertsT(locale, key)
  const assertive = live.assertive.map((event) => stripEventText(locale, event)).join(' ')
  const polite = live.notice || live.polite.map((event) => stripEventText(locale, event)).join(' ')
  return (
    <div data-testid="safety-strip-region">
      {/* Both regions exist before their first message, so the first one is announced. The keyed span
          makes a repeated sentence a new node (announced again); an unchanged one is left alone. */}
      <p role="alert" className="sr-only" data-testid="safety-strip-alert">
        {assertive && <span key={live.seq}>{assertive}</span>}
      </p>
      <p
        role="status"
        data-testid="safety-strip-status"
        className={live.notice ? 'mb-2 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-800' : 'sr-only'}
      >
        {polite && <span key={live.seq}>{polite}</span>}
      </p>
      {alerts.length > 0 && (
        <div data-testid="safety-strip" className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
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
              const state = alertShownState(alert, clock)
              const high = isHighSeverity(alert.severity)
              const age = relativeAge(alert.created_at, locale, clock, tz)
              const titleId = `safety-strip-title-${alert.id}`
              const actions = stripActions(alert, { isGuest }, clock)
              return (
                <li
                  key={alert.id}
                  className="flex flex-col gap-1"
                  onFocus={() => onEngage?.(alert.id, true)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onEngage?.(alert.id, false)
                  }}
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
                            <span data-testid={`safety-strip-resolved-${alert.id}`} className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-900">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              {t('stateResolved')}
                            </span>
                          )}
                          {state === 'gone' && (
                            <span data-testid={`safety-strip-ended-${alert.id}`} className="rounded border border-stone-300 bg-stone-100 px-1.5 py-0.5 text-xs font-medium text-stone-800">
                              {t('stateEnded')}
                            </span>
                          )}
                          {state === 'live' && !alert.verified && <span className="text-xs text-stone-700">{t('stateUnverified')}</span>}
                        </span>
                        {alert.description && (
                          <span className="mt-0.5 block text-xs text-stone-800 line-clamp-1" lang="" dir="auto">
                            {alert.description}
                          </span>
                        )}
                        <span className="mt-0.5 block text-xs text-stone-700">
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
                  {actions.length > 0 && (
                    <span className="ms-7 flex flex-wrap gap-1.5">
                      {actions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          // Named by its visible text; the alert's title says which alert (five entries share these words).
                          aria-describedby={titleId}
                          className={ALERT_ACTION_BUTTON_CLASS}
                          data-testid={`safety-strip-${action}-${alert.id}`}
                          onClick={(e) => onAction?.(action, alert, e.currentTarget)}
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
