'use client'

// apps/web/src/components/feed/report-dialog.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Report this post" for a signed-in member (guests get a create-account prompt instead — the
// server refuses their reports). Translated; the confirmation stays until the member closes it (no
// timer, WCAG 2.2.1) and is announced (role="status", 4.1.3). Focus returns to the opener.

import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { dir, type Locale } from '@/lib/i18n'
import { cardT, REPORT_REASONS, reportReasonLabel } from '@/lib/i18n-feed-card'
import { createSingleFlight } from './composer-guards'

export function ReportDialog({
  postId,
  locale,
  onSubmit,
  onClose,
  returnFocusRef,
  onClosed,
}: {
  /** The post to report; open while non-null. */
  postId: string | null
  locale: Locale
  /** Sends the report; rejects with a message to show. */
  onSubmit: (postId: string, reason: string, details: string | null) => Promise<unknown>
  onClose: () => void
  returnFocusRef?: React.RefObject<HTMLElement | null>
  /** The dialog has closed and focus is back. */
  onClosed?: () => void
}) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const gate = useRef(createSingleFlight())
  const doneRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    setReason('')
    setDetails('')
    setDone(false)
    setError(null)
  }, [postId])

  const submit = async () => {
    if (!postId || !reason) return
    await gate.current.run(async () => {
      setSubmitting(true)
      setError(null)
      try {
        await onSubmit(postId, reason, details.trim() || null)
        setDone(true)
        // The form is replaced by the confirmation: focus moves to it (it is also announced).
        requestAnimationFrame(() => doneRef.current?.focus())
      } catch {
        setError(cardT(locale, 'reportFailed'))
      } finally {
        setSubmitting(false)
      }
    })
  }

  const id = postId ?? 'none'
  return (
    <Dialog open={postId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        lang={locale}
        dir={dir(locale)}
        className="max-w-sm"
        aria-describedby={undefined}
        onCloseAutoFocus={(e) => {
          if (returnFocusRef?.current) {
            e.preventDefault()
            returnFocusRef.current.focus()
          } else e.preventDefault()
          onClosed?.()
        }}
      >
        <DialogHeader>
          <DialogTitle>{cardT(locale, 'reportTitle')}</DialogTitle>
        </DialogHeader>
        <p role="status" ref={doneRef} tabIndex={-1} data-testid="report-done" className={done ? 'py-4 text-center text-sm text-stone-800 focus:outline-hidden' : 'sr-only'}>
          {done ? cardT(locale, 'reportThanks') : ''}
        </p>
        {!done && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`report-reason-${id}`}>{cardT(locale, 'reportReason')}</Label>
              <Select value={reason} onValueChange={setReason} required>
                <SelectTrigger id={`report-reason-${id}`} data-testid={`report-reason-select-${id}`} aria-required="true">
                  <SelectValue placeholder={cardT(locale, 'reportReasonPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {reportReasonLabel(r, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`report-details-${id}`}>
                {cardT(locale, 'reportDetails')} <span className="font-normal text-stone-600">{cardT(locale, 'optional')}</span>
              </Label>
              <Textarea
                id={`report-details-${id}`}
                data-testid={`report-details-${id}`}
                dir="auto"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
                placeholder={cardT(locale, 'reportDetailsPlaceholder')}
                className="resize-none text-stone-900 placeholder:text-stone-500"
                rows={3}
                aria-describedby={`report-details-count-${id}`}
              />
              <p id={`report-details-count-${id}`} className="text-end text-xs text-stone-600">
                {details.length}/1000
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-800">
                {error}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          {done ? (
            <Button type="button" variant="outline" onClick={onClose}>
              {cardT(locale, 'close')}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                {cardT(locale, 'cancel')}
              </Button>
              <Button onClick={() => void submit()} disabled={!reason || submitting} data-testid={`report-submit-${id}`}>
                {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {cardT(locale, 'submitReport')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
