'use client'

// apps/web/src/components/alerts/alert-dialogs.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The two alert dialogs a surface mounts once (the feed strip, the map): Update / Mark resolved /
// Withdraw (alert-editor-dialog.tsx) and History (alert-history-dialog.tsx), opened by one request.
// useAlertDialog holds the request and the control that opened it, so focus returns there on close.

import React, { useCallback, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import type { AlertSurface, SafetyAlert } from '@/lib/safety-alert-rpc'
import type { AlertHost } from '@/hooks/use-safety-strip'
import type { StripAction } from '@/components/feed/safety-strip'
import { AlertEditorDialog } from './alert-editor-dialog'
import { AlertHistoryDialog } from './alert-history-dialog'

export interface AlertDialogRequest {
  action: StripAction
  alertId: string
}

export function useAlertDialog() {
  const [request, setRequest] = useState<AlertDialogRequest | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const open = useCallback((action: StripAction, alert: SafetyAlert, trigger: HTMLElement) => {
    triggerRef.current = trigger
    setRequest({ action, alertId: alert.id })
  }, [])
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
