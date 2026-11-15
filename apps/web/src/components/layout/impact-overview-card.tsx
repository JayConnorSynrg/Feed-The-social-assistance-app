'use client'

// apps/web/src/components/layout/impact-overview-card.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The "Impact overview" card in the shell's metrics strip (feed-shell.tsx MetricsSection), under every panel.
// It shows community_impact_summary() as the server answered it (specs/impact-metrics-contract.md):
//   - directory figures in full, community figures as a number or "Not enough activity yet to share";
//   - titled Community reach until an outcome figure is shown, then Community impact;
//   - in the reader's language and direction, numbers in the locale's digits;
//   - a loading line, and on a failed read a sentence with Retry.
// One read per shell mount (useCommunityImpact); one impact.view row when the figures first show.

import { useEffect, useId, useRef } from 'react'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { useCommunityImpact, type ImpactState, type ImpactSurface } from '@/hooks/use-community-impact'
import { logEvent } from '@/lib/logger'
import { dir, type Locale } from '@/lib/i18n'
import { formatCount } from '@/lib/i18n-intl'
import { impactT, type ImpactMessages } from '@/lib/i18n-impact'
import {
  COMMUNITY_FIGURE_IDS,
  DIRECTORY_FIGURE_IDS,
  cardKind,
  shownValue,
  suppressedCount,
  type ImpactFigureId,
  type ImpactSummary,
} from '@/lib/community-impact'

const NOTE_KEYS: Array<keyof ImpactMessages> = ['noteGeneral', 'noteResources', 'noteNeedsMet', 'notePeopleServed', 'noteEventDates']

function FigureList({ ids, summary, locale, heading }: { ids: readonly ImpactFigureId[]; summary: ImpactSummary; locale: Locale; heading: string }) {
  const present = ids.filter((id) => summary[id])
  if (present.length === 0) return null
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-600 mb-1">{heading}</h4>
      <dl className="space-y-1">
        {present.map((id) => {
          const value = shownValue(summary[id])
          return (
            <div key={id} data-figure={id} className="flex items-baseline justify-between gap-3 text-sm">
              <dt className="text-stone-700">{impactT(locale, `label_${id}`)}</dt>
              {value === null ? (
                <dd className="text-xs text-stone-600 text-end">{impactT(locale, 'suppressed')}</dd>
              ) : (
                <dd className="font-semibold text-stone-900 tabular-nums">{formatCount(value, locale)}</dd>
              )}
            </div>
          )
        })}
      </dl>
    </div>
  )
}

/** The card for a given read state (no data access: the container below supplies it).
 *  `retried`: the member pressed Retry on this mount. Loading and a first failure are said politely through
 *  one status region that is always there; only a failure after the member's own Retry is said assertively.
 *  Retry moves focus to the card title, which stays while the button goes away. */
export function ImpactOverview({ state, locale, onRetry, retried = false }: { state: ImpactState; locale: Locale; onRetry: () => void; retried?: boolean }) {
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const title = state.status === 'ready' && cardKind(state.summary) === 'impact' ? impactT(locale, 'titleImpact') : impactT(locale, 'titleReach')
  const failed = state.status === 'error'
  const statusText = state.status === 'loading' ? impactT(locale, 'loading') : failed && !retried ? impactT(locale, 'loadFailed') : ''
  const alertText = failed && retried ? impactT(locale, 'loadFailed') : ''
  const onRetryClick = () => {
    onRetry()
    headingRef.current?.focus()
  }

  return (
    <section
      aria-labelledby={headingId}
      lang={locale}
      dir={dir(locale)}
      className="bg-[#f8f6f1] rounded-xl p-4 border border-stone-200/50 shadow-sm min-h-[120px] flex flex-col gap-3"
    >
      <h3 id={headingId} ref={headingRef} tabIndex={-1} className="text-sm font-medium text-stone-600">{title}</h3>

      <p role="status" className={statusText ? 'text-sm text-stone-700' : 'sr-only'}>{statusText}</p>
      <p role="alert" className={alertText ? 'text-sm text-stone-700' : 'sr-only'}>{alertText}</p>

      {failed && (
        <button
          type="button"
          onClick={onRetryClick}
          className="self-start min-h-6 inline-flex items-center text-sm font-medium text-[#4a5d23] hover:text-[#3d4d1c] underline underline-offset-2"
        >
          {impactT(locale, 'retry')}
        </button>
      )}

      {state.status === 'ready' && (
        <>
          <FigureList ids={DIRECTORY_FIGURE_IDS} summary={state.summary} locale={locale} heading={impactT(locale, 'groupDirectory')} />
          <FigureList ids={COMMUNITY_FIGURE_IDS} summary={state.summary} locale={locale} heading={impactT(locale, 'groupCommunity')} />
          <details className="text-xs text-stone-600">
            <summary className="cursor-pointer py-1 font-medium text-stone-700">{impactT(locale, 'howWeCount')}</summary>
            <div className="mt-1 space-y-1">
              {NOTE_KEYS.map((key) => (
                <p key={key}>{impactT(locale, key)}</p>
              ))}
            </div>
          </details>
        </>
      )}
    </section>
  )
}

export function ImpactOverviewCard({ surface = 'overview' }: { surface?: ImpactSurface }) {
  const locale = useProfileLocale()
  const { state, retry, retried } = useCommunityImpact(surface)

  // A mount reaches 'ready' once (Retry is offered only after a failure), so this writes one row per mount.
  useEffect(() => {
    if (state.status !== 'ready') return
    logEvent('impact.view', { surface, suppressed_count: suppressedCount(state.summary) })
  }, [state, surface])

  return <ImpactOverview state={state} locale={locale} onRetry={retry} retried={retried} />
}
