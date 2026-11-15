'use client'

// apps/web/src/components/alerts/alert-dialogs.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The two alert dialogs a surface mounts once (the feed strip, the map): Update / Mark resolved /
// Withdraw (alert-editor-dialog.tsx) and History (alert-history-dialog.tsx), opened by one request.
// useAlertDialog holds the request and the control that opened it, so focus returns there on close.

import React, { useCallback, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { dir, type Locale } from '@/lib/i18n'
import { alertsT } from '@/lib/i18n-feed-alerts'
import type { AlertSurface, SafetyAlert } from '@/lib/safety-alert-rpc'
import type { AlertHost } from '@/hooks/use-safety-strip'
import type { StripAction } from '@/components/feed/safety-strip'
import { AlertEditorDialog } from './alert-editor-dialog'
import { AlertHistoryDialog } from './alert-history-dialog'

export interface AlertDialogRequest {
  action: StripAction
  alertId: string
}

/** `onOpen` runs when the member starts an action (the surface clears its last notice). */
export function useAlertDialog(onOpen?: () => void) {
  const [request, setRequest] = useState<AlertDialogRequest | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const open = useCallback(
    (action: StripAction, alert: SafetyAlert, trigger: HTMLElement) => {
      triggerRef.current = trigger
      onOpen?.()
      setRequest({ action, alertId: alert.id })
    },
    [onOpen],
  )
  const close = useCallback(() => setRequest(null), [])
  return { request, open, close, triggerRef }
}

export function AlertDialogs({
  request,
  locale,
  surface,
  host,
  onClose,
  returnFocusRef,
}: {
  request: AlertDialogRequest | null
  locale: Locale
  surface: AlertSurface
  host: AlertHost
  onClose: () => void
  returnFocusRef: React.RefObject<HTMLElement | null>
}) {
  const action = request?.action ?? null
  return (
    <>
      <AlertEditorDialog
        request={request && action !== null && action !== 'history' ? { kind: action, alertId: request.alertId } : null}
        locale={locale}
        surface={surface}
        host={host}
        onClose={onClose}
        returnFocusRef={returnFocusRef}
      />
      <AlertHistoryDialog
        alertId={request && action === 'history' ? request.alertId : null}
        locale={locale}
        surface={surface}
        host={host}
        onClose={onClose}
        returnFocusRef={returnFocusRef}
      />
    </>
  )
}

/**
 * What the member's own alert action did on the map: said once politely, and shown as a line ABOVE
 * the map — in the page's flow, so it can never cover a marker or a popup — until the member
 * dismisses it or starts the next action.
 *
 * The status region is mounted from the start and stays the same node: its text is put INTO a region
 * that already exists (a region that arrives with its text already in it is often not spoken). While
 * there is nothing to say, the wrapper is taken out of the layout (sr-only), so it is no flex child
 * and the map sits exactly where it would without it.
 *
 * Dismiss takes its own button away: when that button has focus, `focusAfterDismiss` is called first
 * (the map), so focus never falls to the page.
 *
 * `stale` is the line "Couldn't refresh alerts — last updated …" while the latest read has failed.
 * It is put into the same region when the map becomes stale (said once: the region is not atomic, so
 * only the line that arrives is read) and taken out by the next read that succeeds. It has no
 * Dismiss: it is a state, not an outcome.
 */
export function MapAlertNotice({
  notice,
  locale,
  onDismiss,
  focusAfterDismiss,
  stale = null,
}: {
  notice: { text: string; seq: number }
  locale: Locale
  onDismiss: () => void
  focusAfterDismiss?: () => void
  /** The stale line, already in the viewer's language; null while the alerts are fresh. */
  stale?: string | null
}) {
  const shown = Boolean(notice.text || stale)
  return (
    <div
      lang={locale}
      dir={dir(locale)}
      data-testid="map-alert-notice"
      className={shown ? 'flex items-start gap-2 rounded-lg border border-stone-400 bg-white px-3 py-2 text-sm text-stone-800' : 'sr-only'}
    >
      {/* The one copy of the text: the status region itself is the visible line. */}
      <p role="status" aria-atomic="false" className={shown ? 'min-w-0 flex-1' : 'sr-only'} data-testid="map-alert-status">
        {notice.text && (
          <span key={notice.seq} className="block">
            {notice.text}
          </span>
        )}
        {stale && (
          <span key="stale" className="block" data-testid="map-alert-stale">
            {stale}
          </span>
        )}
      </p>
      {notice.text && (
          <button
            type="button"
            aria-label={alertsT(locale, 'dismiss')}
            data-testid="map-alert-notice-dismiss"
            onClick={(e) => {
              // (A pointer press that left focus elsewhere moves nothing.)
              if (document.activeElement === e.currentTarget) focusAfterDismiss?.()
              onDismiss()
            }}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-stone-700 hover:bg-stone-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
      )}
    </div>
  )
}
