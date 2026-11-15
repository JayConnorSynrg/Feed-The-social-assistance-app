'use client'

// apps/web/src/components/alerts/alert-history-dialog.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What changed on a safety alert, newest first, for everyone who can see the alert
// (safety_alert_history, specs/r3-contract.md). Each entry says when, what and by which ROLE:
// reported, updated by the reporter or by a moderator (severity raised or lowered, description
// changed or removed, type changed, location moved), marked resolved — with the expiry that version
// carries, so a severity change shows its new expiry. A role, never a name or an id (the same rule
// as the post history). Member-written text keeps its own direction.
// A proper dialog: the title takes focus (with a visible ring), "History loaded" is announced
// politely with the number of entries, Escape closes, focus returns to the control that opened it
// (or, when that is gone, to the alert's own place, or the next sensible place on the surface).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/format-message'
import { alertName, alertSeverityLabel, alertTypeLabel, alertsT, type AlertMessages } from '@/lib/i18n-feed-alerts'
import { readSafetyAlertHistory, type AlertHistoryEntry, type AlertSurface } from '@/lib/safety-alert-rpc'
import type { AlertHost } from '@/hooks/use-safety-strip'
import { formatAlertDateTime } from './alert-edit-model'

/** "Updated by a moderator", "Marked resolved by the reporter": what happened, credited to a role.
 *  The first message is the report itself; a message with no role keeps the plain wording. */
export function historyEntryTitle(entry: Pick<AlertHistoryEntry, 'msg_type' | 'actor_role'>): keyof AlertMessages {
  if (entry.msg_type === 'alert') return 'histReported'
  if (entry.msg_type === 'all_clear') {
    return entry.actor_role === 'owner' ? 'histResolvedByReporter' : entry.actor_role === 'moderator' ? 'histResolvedByModerator' : 'histResolved'
  }
  return entry.actor_role === 'owner' ? 'histUpdatedByReporter' : entry.actor_role === 'moderator' ? 'histUpdatedByModerator' : 'histUpdated'
}

/** What one version changed, as sentences (never who changed it). */
export function historyChangeLines(entry: AlertHistoryEntry, locale: Locale, tz?: string): string[] {
  const lines: string[] = []
  const when = formatAlertDateTime(entry.expires_at, locale, tz)
  if (entry.msg_type === 'all_clear') return [formatMessage(alertsT(locale, 'shownUntil'), { when })]
  if (entry.msg_type === 'alert') lines.push(alertName(entry, locale))
  if (entry.severity_change !== 'same') {
    lines.push(
      formatMessage(alertsT(locale, entry.severity_change === 'escalated' ? 'histSeverityRaised' : 'histSeverityLowered'), {
        severity: alertSeverityLabel(entry.severity, locale),
      }),
    )
  }
  if (entry.changed.includes('alert_type')) lines.push(formatMessage(alertsT(locale, 'histTypeChanged'), { type: alertTypeLabel(entry.alert_type, locale) }))
  if (entry.changed.includes('description')) lines.push(alertsT(locale, entry.description ? 'histTextChanged' : 'histTextRemoved'))
  if (entry.changed.includes('location')) lines.push(alertsT(locale, 'histLocationMoved'))
  lines.push(formatMessage(alertsT(locale, 'expiresAt'), { when }))
  return lines
}

/** The version list (stateless, server-renderable — the dialog wraps it). */
export function AlertHistoryList({ entries, locale, tz }: { entries: readonly AlertHistoryEntry[]; locale: Locale; tz?: string }) {
  return (
    <ol className="flex flex-col gap-3" data-testid="alert-history-list">
      {entries.map((entry) => {
        const showsText = entry.description !== null && (entry.msg_type === 'alert' || entry.changed.includes('description'))
        return (
          <li key={entry.version} className="rounded-lg border border-stone-200 p-3" data-testid={`alert-history-entry-${entry.version}`}>
            <p className="text-sm font-semibold text-stone-900">
              {alertsT(locale, historyEntryTitle(entry))} · <time dateTime={entry.sent_at}>{formatAlertDateTime(entry.sent_at, locale, tz)}</time>
            </p>
            <ul className="mt-1 list-none text-xs text-stone-700">
              {historyChangeLines(entry, locale, tz).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {showsText && (
              <p lang="" dir="auto" className="mt-2 whitespace-pre-wrap break-words text-sm text-stone-800">
                {entry.description}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function AlertHistoryDialog({
  alertId,
  locale,
  surface,
  host,
  onClose,
  returnFocusRef,
  tz,
}: {
  /** The alert whose history is open; null = closed. */
  alertId: string | null
  locale: Locale
  surface: AlertSurface
  host: Pick<AlertHost, 'focusAfterLeave' | 'focusAlert'>
  onClose: () => void
  returnFocusRef?: React.RefObject<HTMLElement | null>
  tz?: string
}) {
  const supabase = useMemo(() => createClient(), [])
  // The read's answer, kept with the alert it belongs to: `entries` null = the read failed.
  const [result, setResult] = useState<{ alertId: string; entries: AlertHistoryEntry[] | null } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const titleRef = useRef<HTMLHeadingElement>(null)
  // The alert the history was last open on (the id is gone by the time focus is handed back).
  const lastAlert = useRef<string | null>(null)
  useEffect(() => {
    if (alertId) lastAlert.current = alertId
  }, [alertId])
  // A new opening starts from "loading" (applied while rendering: the documented alternative to
  // resetting state in an effect).
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  if (openedFor !== alertId) {
    setOpenedFor(alertId)
    setResult(null)
  }

  // One read per opening (keyed on the alert id; a re-render reads nothing). Retry reads again.
  useEffect(() => {
    if (!alertId) return
    let active = true
    readSafetyAlertHistory(supabase, alertId, surface).then(
      (entries) => {
        if (active) setResult({ alertId, entries })
      },
      () => {
        if (active) setResult({ alertId, entries: null })
      },
    )
    return () => {
      active = false
    }
  }, [alertId, supabase, surface, attempt])

  const retry = useCallback(() => {
    setResult(null)
    setAttempt((n) => n + 1)
  }, [])

  const state: { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; entries: AlertHistoryEntry[] } =
    !result || result.alertId !== alertId ? { kind: 'loading' } : result.entries ? { kind: 'ready', entries: result.entries } : { kind: 'error' }

  return (
    <Dialog open={alertId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        hideDefaultClose
        lang={locale}
        dir={dir(locale)}
        aria-describedby={undefined}
        className="max-h-[90vh] max-w-lg overflow-y-auto"
        data-testid="alert-history-dialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          titleRef.current?.focus()
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          const opener = returnFocusRef?.current
          if (opener && opener.isConnected) opener.focus()
          else if (!lastAlert.current || !host.focusAlert(lastAlert.current)) host.focusAfterLeave()
        }}
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="rounded-sm text-start focus:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2">
            {alertsT(locale, 'historyTitle')}
          </DialogTitle>
        </DialogHeader>
        {/* Loading, then "History loaded. Entries: N." — said politely, once each. */}
        <p role="status" className="sr-only" data-testid="alert-history-status">
          {state.kind === 'loading'
            ? alertsT(locale, 'historyLoading')
            : state.kind === 'ready'
              ? formatMessage(alertsT(locale, 'historyLoaded'), { n: state.entries.length })
              : ''}
        </p>
        {state.kind === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-stone-700" aria-hidden="true">
            <Loader2 className="h-4 w-4 animate-spin" />
            {alertsT(locale, 'historyLoading')}
          </p>
        )}
        {state.kind === 'error' && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-800">
            {alertsT(locale, 'historyLoadFailed')}
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              {alertsT(locale, 'retry')}
            </Button>
          </div>
        )}
        {state.kind === 'ready' &&
          (state.entries.length > 0 ? (
            <AlertHistoryList entries={state.entries} locale={locale} tz={tz} />
          ) : (
            <p className="text-sm text-stone-700" data-testid="alert-history-empty">
              {alertsT(locale, 'historyEmpty')}
            </p>
          ))}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {alertsT(locale, 'close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
