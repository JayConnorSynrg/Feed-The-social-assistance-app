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
 * What the member's own alert action did on the map: said once politely (the region is mounted from
 * the start), and shown as a line ABOVE the map — in the page's flow, so it can never cover a marker
 * or a popup — until the member dismisses it or starts the next action.
 */
export function MapAlertNotice({ notice, locale, onDismiss }: { notice: { text: string; seq: number }; locale: Locale; onDismiss: () => void }) {
  return (
    <div
      lang={locale}
      dir={dir(locale)}
      data-testid="map-alert-notice"
      className={notice.text ? 'flex items-start gap-2 rounded-lg border border-stone-400 bg-white px-3 py-2 text-sm text-stone-800' : undefined}
    >
      {/* The one copy of the text: the status region itself is the visible line. */}
      <p role="status" className={notice.text ? 'min-w-0 flex-1' : 'sr-only'} data-testid="map-alert-status">
        {notice.text && <span key={notice.seq}>{notice.text}</span>}
      </p>
      {notice.text && (
          <button
            type="button"
            aria-label={alertsT(locale, 'dismiss')}
            data-testid="map-alert-notice-dismiss"
            onClick={onDismiss}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-stone-700 hover:bg-stone-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
      )}
    </div>
  )
}
