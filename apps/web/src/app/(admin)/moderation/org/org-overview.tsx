'use client'

// apps/web/src/app/(admin)/moderation/org/org-overview.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Overview tab of the organization admin page: this organization's numbers only (the platform
// OverviewTab is platform-wide and is not used here). After "Try again", focus moves to the
// section heading once the reload settles, so it never stays on the removed button.
// "Repeating events ending soon" lists this organization's series whose last date is within 30
// days (or passed), each with "Repeat for 6 more months"; an extended series leaves the list, so
// focus moves to the list's heading and the status line says until when it now repeats.

import { useEffect, useMemo, useRef, useState, type Ref } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { eventFormT, formatMessage } from '@/lib/i18n-event-forms'
import { formatCalendarDate } from '@/lib/event-time'
import { ExtendSeriesButton } from '../extend-series-button'
import { fetchEndingSoon, fetchOrgOverview, type EndingSoonSeries, type OrgOverviewCounts } from './org-overview-data'

const TILES: Array<{ key: keyof OrgOverviewCounts; label: string }> = [
  { key: 'activeEvents', label: 'Active events' },
  { key: 'upcomingDates', label: 'Event dates, next 30 days' },
  { key: 'checkinsLast30Days', label: 'Check-ins, last 30 days' },
  { key: 'members', label: 'Members' },
]

type LoadState = 'loading' | 'ready' | 'error'

/**
 * After a retry, once the reload has settled (ready or error), focus the section heading exactly
 * once. The first load never moves focus. Returns true when it focused.
 */
export function focusAfterRetry(
  retryPending: { current: boolean },
  state: LoadState,
  heading: { focus: () => void } | null
): boolean {
  if (!retryPending.current || state === 'loading') return false
  retryPending.current = false
  heading?.focus()
  return true
}

export function OrgOverview({ orgId }: { orgId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [counts, setCounts] = useState<OrgOverviewCounts | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [retry, setRetry] = useState(0)
  const retryPending = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    focusAfterRetry(retryPending, state, headingRef.current)
  }, [state])

  useEffect(() => {
    let cancelled = false
    fetchOrgOverview(supabase, orgId).then(
      (c) => {
        if (cancelled) return
        setCounts(c)
        setState('ready')
      },
      () => {
        if (!cancelled) setState('error')
      }
    )
    return () => {
      cancelled = true
    }
  }, [supabase, orgId, retry])

  return (
    <div className="space-y-6">
      <OrgOverviewView
        counts={counts}
        state={state}
        headingRef={headingRef}
        onRetry={() => {
          retryPending.current = true
          setState('loading')
          setRetry((n) => n + 1)
        }}
      />
      <EndingSoonSection orgId={orgId} />
    </div>
  )
}

function EndingSoonSection({ orgId }: { orgId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [series, setSeries] = useState<EndingSoonSeries[] | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [reload, setReload] = useState(0)
  const [notice, setNotice] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const retryPending = useRef(false)

  // After "Try again", focus the heading once the reload settles (the button is gone either way).
  useEffect(() => {
    focusAfterRetry(retryPending, state, headingRef.current)
  }, [state])

  useEffect(() => {
    let cancelled = false
    void fetchEndingSoon(supabase, orgId).then((r) => {
      if (cancelled) return
      if (r.ok) {
        setSeries(r.series)
        setState('ready')
      } else setState('error')
    })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId, reload])

  return (
    <EndingSoonView
      series={series}
      state={state}
      notice={notice}
      headingRef={headingRef}
      orgId={orgId}
      onRetry={() => {
        retryPending.current = true
        setState('loading')
        setReload((n) => n + 1)
      }}
      onStart={() => setNotice('')}
      onExtended={(until) => {
        setNotice(formatMessage(eventFormT('en', 'seriesExtended'), { date: formatCalendarDate(until.slice(0, 10), 'en') }))
        // The extended series leaves this list (it now ends six months out): continue from the heading.
        headingRef.current?.focus()
        setReload((n) => n + 1)
      }}
    />
  )
}

export function EndingSoonView({
  series,
  state,
  notice,
  orgId,
  onRetry,
  onStart,
  onExtended,
  headingRef,
}: {
  series: EndingSoonSeries[] | null
  state: LoadState
  notice: string
  orgId: string
  onRetry: () => void
  onStart?: () => void
  onExtended: (until: string) => void
  headingRef?: Ref<HTMLHeadingElement>
}) {
  return (
    <section lang="en" dir="ltr" aria-labelledby="org-ending-soon-heading">
      <h2
        id="org-ending-soon-heading"
        ref={headingRef}
        tabIndex={-1}
        className="mb-3 rounded-sm text-base font-semibold text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        Repeating events ending in the next 30 days
      </h2>
      <p role="status" className="mb-2 text-sm text-lime-800">
        {notice}
      </p>
      {state === 'loading' ? (
        <p className="flex items-center gap-2 text-sm text-stone-600" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading…
        </p>
      ) : state === 'error' || !series ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-sm text-red-700">Could not load the repeating events that end soon.</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-9 items-center rounded-lg border border-stone-500 bg-white px-3 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </div>
      ) : series.length === 0 ? (
        <p className="text-sm text-stone-700">No repeating event ends in the next 30 days.</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white px-4">
          {series.map((s) => {
            const titleId = `ending-${s.eventId}-title`
            const endId = `ending-${s.eventId}-end`
            return (
              <li key={s.eventId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p id={titleId} className="text-sm font-medium text-stone-900">
                    {s.title}
                  </p>
                  <p id={endId} className="text-xs text-stone-700">
                    {s.lastDate && s.remaining > 0
                      ? formatMessage(eventFormT('en', 'seriesEndingSoon'), { date: formatCalendarDate(s.lastDate, 'en') })
                      : eventFormT('en', 'seriesEnded')}
                  </p>
                </div>
                <ExtendSeriesButton
                  eventId={s.eventId}
                  orgId={orgId}
                  title={s.title}
                  locale="en"
                  describedBy={endId}
                  onStart={onStart}
                  onExtended={(r) => onExtended(r.until)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function OrgOverviewView({
  counts,
  state,
  onRetry,
  headingRef,
}: {
  counts: OrgOverviewCounts | null
  state: LoadState
  onRetry: () => void
  headingRef?: Ref<HTMLHeadingElement>
}) {
  return (
    <section lang="en" dir="ltr" aria-labelledby="org-overview-heading">
      <h2
        id="org-overview-heading"
        ref={headingRef}
        tabIndex={-1}
        className="mb-3 rounded-sm text-base font-semibold text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        This organization at a glance
      </h2>
      <OverviewBody counts={counts} state={state} onRetry={onRetry} />
    </section>
  )
}

function OverviewBody({ counts, state, onRetry }: { counts: OrgOverviewCounts | null; state: LoadState; onRetry: () => void }) {
  if (state === 'loading') {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-stone-600" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading overview…
      </p>
    )
  }
  if (state === 'error' || !counts) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-stone-200 bg-white p-6">
        <p className="text-sm text-red-700">Could not load this organization’s numbers.</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-9 items-center rounded-lg border border-stone-500 bg-white px-3 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    )
  }
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TILES.map((t) => (
        <div key={t.key} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <dt className="text-xs font-medium text-stone-600">{t.label}</dt>
          <dd className="mt-1 text-2xl font-semibold text-stone-900">{counts[t.key]}</dd>
        </div>
      ))}
    </dl>
  )
}
