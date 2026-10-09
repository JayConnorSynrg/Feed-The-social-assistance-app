'use client'

// apps/web/src/components/feed/post-delete-dialog.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Delete this post?" / "Delete this comment?" — an explicit confirmation (AlertDialog: no outside
// click, focus starts on Cancel, Escape cancels). The delete runs once (single-flight) and the dialog
// stays open with a spinner until the server answers; a refusal is shown in the dialog. A post or
// comment that is already gone counts as deleted. Focus then returns to the opener.

import React, { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { dir, type Locale } from '@/lib/i18n'
import { editT } from '@/lib/i18n-feed-edit'
import { createSingleFlight } from './composer-guards'

export function ConfirmDeleteDialog({
  open,
  kind,
  locale,
  onConfirm,
  onClose,
  returnFocusRef,
}: {
  open: boolean
  kind: 'post' | 'comment'
  locale: Locale
  /** Runs the delete; resolves to an error message to show, or null when it is done. */
  onConfirm: () => Promise<string | null>
  onClose: () => void
  returnFocusRef?: React.RefObject<HTMLElement | null>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const gate = useRef(createSingleFlight())

  const confirm = async () => {
    await gate.current.run(async () => {
      setBusy(true)
      setError(null)
      try {
        const message = await onConfirm()
        if (message) setError(message)
        else onClose()
      } finally {
        setBusy(false)
      }
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) {
          setError(null)
          onClose()
        }
      }}
    >
      <AlertDialogContent
        lang={locale}
        dir={dir(locale)}
        data-testid={`${kind}-delete-dialog`}
        onCloseAutoFocus={(e) => {
          if (returnFocusRef?.current) {
            e.preventDefault()
            returnFocusRef.current.focus()
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{editT(locale, kind === 'post' ? 'deletePostTitle' : 'deleteCommentTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{editT(locale, kind === 'post' ? 'deletePostBody' : 'deleteCommentBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-red-800">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{editT(locale, 'cancel')}</AlertDialogCancel>
          <Button
            type="button"
            onClick={() => void confirm()}
            aria-disabled={busy || undefined}
            className="min-h-10 bg-red-700 text-white hover:bg-red-800"
            data-testid={`${kind}-delete-confirm`}
          >
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {editT(locale, 'deleteConfirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
