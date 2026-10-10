'use client'

// apps/web/src/components/events/cancel-date-confirm.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Cancel this date?" — the one confirmation for cancelling a single event date, shared by the admin
// scheduler and an event card's ⋯ menu (community feed, Events tab). Open while `target` is set.
// Confirming makes ONE cancel_event_occurrence call (lib/event-admin-rpc.ts: privilegedRpc, the
// database decides permission, one admin.occurrence.cancel row); a second click while it is in
// flight is refused before any request, and the dialog cannot be dismissed mid-call. A refusal
// stays in the dialog as a translated message (never database text).

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { dir, type Locale } from '@/lib/i18n'
import { eventFormT, formatMessage } from '@/lib/i18n-event-forms'
import { formatEventWhen } from '@/lib/event-time'
import { cancelEventOccurrence, type EventWriteSurface } from '@/lib/event-admin-rpc'
import { createSubmitController, mintIdempotencyKey, type FieldError } from '@/lib/event-form-model'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DANGER, SECONDARY, errorText } from './event-form-ui'

/** The date to cancel and what the confirmation names. */
export interface CancelDateTarget {
  occurrenceId: string
  eventId: string
  orgId: string
  title: string
  startsAt: string
  endsAt: string
  timeZone: string
}

export function CancelDateConfirm({
  target,
  locale,
  onClose,
  onCancelled,
  onCloseAutoFocus,
  surface = 'admin',
}: {
  /** The date being confirmed; null = closed. */
  target: CancelDateTarget | null
  locale: Locale
  /** Keep the date / Escape: the caller clears `target`. */
  onClose: () => void
  /** The date was cancelled (the caller clears `target` and refreshes). */
  onCancelled: (target: CancelDateTarget) => void
  onCloseAutoFocus?: (event: Event) => void
  surface?: EventWriteSurface
}) {
  const supabase = useMemo(() => createClient(), [])
  const [controller] = useState(() => createSubmitController(mintIdempotencyKey))
  const [cancelling, setCancelling] = useState(false)
  // The refusal belongs to the date it was shown for: opening another date starts clean.
  const [failure, setFailure] = useState<{ occurrenceId: string; error: FieldError } | null>(null)
  const error = failure && target && failure.occurrenceId === target.occurrenceId ? failure.error : null

  // Closing drops the refusal, so reopening the same date starts clean too.
  const close = () => {
    setFailure(null)
    onClose()
  }

  async function confirm() {
    if (!target || controller.inFlight) return
    const t = target
    setFailure(null)
    setCancelling(true)
    const outcome = await controller.submit(() =>
      cancelEventOccurrence(supabase, { occurrenceId: t.occurrenceId, eventId: t.eventId, orgId: t.orgId, surface })
    )
    setCancelling(false)
    if (outcome.status === 'busy') return
    if (outcome.result.ok) onCancelled(t)
    else setFailure({ occurrenceId: t.occurrenceId, error: { key: outcome.result.errorKey } })
  }

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !cancelling) close()
      }}
    >
      <AlertDialogContent lang={locale} dir={dir(locale)} onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{eventFormT(locale, 'cancelConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {target &&
              formatMessage(eventFormT(locale, 'cancelConfirmBody'), {
                title: target.title,
                when: formatEventWhen(target.startsAt, target.endsAt, target.timeZone, locale).text,
              })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {errorText(locale, error)}
          </p>
        )}
        <AlertDialogFooter>
          {/* The dialog's Cancel: focus starts here when it opens (the safe choice), and choosing it
              closes the dialog through onOpenChange. */}
          <AlertDialogCancel className={SECONDARY} disabled={cancelling}>
            {eventFormT(locale, 'keepDate')}
          </AlertDialogCancel>
          <button type="button" className={DANGER} aria-disabled={cancelling || undefined} onClick={() => void confirm()}>
            {cancelling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {eventFormT(locale, 'cancelDate')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
