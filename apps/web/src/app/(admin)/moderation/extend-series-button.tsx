'use client'

// apps/web/src/app/(admin)/moderation/extend-series-button.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Repeat for 6 more months" on a repeating event that ends: one tap = one extend_event_series
// call (privilegedRpc -> one admin_actions row + one app_logs row). The idempotency key is minted
// when the button mounts and kept until a call succeeds, so a retry after a lost answer extends
// once; a second tap while a call is in flight sends nothing. The button stays focusable while it
// works (aria-disabled, never disabled) and the parent announces the result in its status line.
// Its accessible name starts with the visible text and adds the event's title ("Repeat for 6 more
// months: Saturday pantry"), so a list of these buttons is told apart.

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/i18n'
import { eventFormT, formatMessage } from '@/lib/i18n-event-forms'
import { extendEventSeries, type ExtendedSeries } from '@/lib/event-admin-rpc'
import { createSubmitController, mintIdempotencyKey, type FieldError, type SubmitController } from '@/lib/event-form-model'
import { SECONDARY, errorText } from '@/components/events/event-form-ui'

/** One tap: extend once (single flight; the key is reused until a call succeeds). */
export async function runExtend(
  controller: SubmitController,
  supabase: SupabaseClient<Database>,
  target: { eventId: string; orgId: string },
): Promise<{ status: 'busy' } | { status: 'done'; result: Awaited<ReturnType<typeof extendEventSeries>> }> {
  return controller.submit((key) => extendEventSeries(supabase, { ...target, idempotencyKey: key }))
}

/** "Repeat for 6 more months: <title>" (or "Extending…: <title>" while it works). */
export function extendButtonName(locale: Locale, title: string, busy: boolean): string {
  return formatMessage(eventFormT(locale, 'seriesExtendAria'), {
    action: eventFormT(locale, busy ? 'seriesExtending' : 'seriesExtend'),
    title,
  })
}

export function ExtendSeriesButton({
  eventId,
  orgId,
  title,
  locale,
  describedBy,
  onStart,
  onExtended,
  className = `${SECONDARY} min-h-9 px-3 text-xs`,
}: {
  eventId: string
  orgId: string
  /** The event's title, part of the button's name. */
  title: string
  locale: Locale
  /** Ids of the series' end line the button acts on. */
  describedBy?: string
  /** Called as a tap starts a call: the parent clears its status line, so the same result
   *  sentence is announced again. */
  onStart?: () => void
  onExtended: (result: ExtendedSeries) => void
  className?: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [controller] = useState(() => createSubmitController(mintIdempotencyKey))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<FieldError | null>(null)
  const errId = `extend-${eventId}-err`

  async function extend() {
    if (controller.inFlight) return
    setBusy(true)
    setError(null)
    onStart?.()
    const outcome = await runExtend(controller, supabase, { eventId, orgId })
    setBusy(false)
    if (outcome.status === 'busy') return
    const r = outcome.result
    if (r.ok) onExtended(r)
    else setError({ key: r.errorKey })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={className}
        aria-disabled={busy || undefined}
        aria-label={extendButtonName(locale, title, busy)}
        aria-describedby={[describedBy, error ? errId : null].filter(Boolean).join(' ') || undefined}
        onClick={() => void extend()}
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        {eventFormT(locale, busy ? 'seriesExtending' : 'seriesExtend')}
      </button>
      {error && (
        <span id={errId} role="alert" className="text-xs text-red-700">
          {errorText(locale, error)}
        </span>
      )}
    </span>
  )
}
