'use client'

// apps/web/src/components/feed/feed-chrome.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The community feed's chrome around the cards, in the viewer's language (lib/i18n-feed-chrome.ts):
// the heading with the Ranked / Recent toggle and the post filters, the list's error / loading /
// empty state, and "Load more posts". A failed read shows a translated sentence chosen by kind
// (timeout, or anything else) — the server's text never reaches the member. FeedPanel
// (components/panels/feed-panel.tsx) owns the state; these only render it.

import { useEffect, useState, type Ref } from 'react'
import { Loader2 } from 'lucide-react'
import { dir, type Locale } from '@/lib/i18n'
import { feedChromeT, type FeedChromeMessages } from '@/lib/i18n-feed-chrome'

/** Ranked-feed ordering mode. Default 'ranked' (proximity/recency/engagement blend via the
 *  ranked_feed RPC); 'recent' is the legacy chronological keyset query. */
export type FeedRankMode = 'ranked' | 'recent'

export type FilterType = 'all' | 'following' | 'mine' | 'announcements'

/** Why the feed could not be read: a timeout, or anything else (permission, server, network). */
export type FeedLoadError = 'timeout' | 'failed'

const FILTERS: ReadonlyArray<{ key: FilterType; label: keyof FeedChromeMessages }> = [
  { key: 'all', label: 'filterAll' },
  { key: 'following', label: 'filterFollowing' },
  { key: 'mine', label: 'filterMine' },
  { key: 'announcements', label: 'filterAnnouncements' },
]
const RANK_MODES: ReadonlyArray<{ key: FeedRankMode; label: keyof FeedChromeMessages }> = [
  { key: 'ranked', label: 'rankRanked' },
  { key: 'recent', label: 'rankRecent' },
]

export interface FeedHeaderProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  rankMode: FeedRankMode
  onRankModeChange: (mode: FeedRankMode) => void
  locale: Locale
  /** The heading (focus lands here when the card that held it leaves the feed). */
  titleRef?: Ref<HTMLHeadingElement>
}

export function FeedHeader({ activeFilter, onFilterChange, rankMode, onRankModeChange, locale, titleRef }: FeedHeaderProps) {
  const t = (key: keyof FeedChromeMessages) => feedChromeT(locale, key)
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 ref={titleRef} tabIndex={-1} className="font-semibold text-lg rounded focus:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700">
          {t('feedTitle')}
        </h2>
        {/* Ranked ↔ chronological toggle (default ranked). */}
        <div role="group" aria-label={t('orderingAria')} className="flex items-center rounded-full bg-[#f0ede6] p-0.5 shrink-0">
          {RANK_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={rankMode === m.key}
              data-testid={`feed-rankmode-${m.key}`}
              onClick={() => onRankModeChange(m.key)}
              className={`min-h-6 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                rankMode === m.key ? 'bg-[#4a5d23] text-white' : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              {t(m.label)}
            </button>
          ))}
        </div>
      </div>
      {/* The post filters: one is on at a time (aria-pressed says which). */}
      <div role="group" aria-label={t('filtersAria')} className="flex gap-2 overflow-x-auto">
        {FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            aria-pressed={activeFilter === filter.key}
            data-testid={`feed-filter-${filter.key}`}
            onClick={() => onFilterChange(filter.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              activeFilter === filter.key ? 'bg-[#4a5d23] text-white' : 'bg-[#f0ede6] hover:bg-[#e8e4db] text-stone-700'
            }`}
          >
            {t(filter.label)}
          </button>
        ))}
      </div>
    </div>
  )
}

export type FeedListState = { kind: 'error'; error: FeedLoadError } | { kind: 'loading' } | { kind: 'empty' }

/**
 * What the feed's list-status region says: the list loading or empty. A failed read is announced by
 * its own role="alert" line instead (never twice). What an event card's ⋯ menu did is NOT said
 * here — it has its own region (FeedStatusRegions), so neither ever hides the other.
 */
export function feedStatusAnnouncement(
  { loading, error, empty }: { loading: boolean; error: boolean; empty: boolean },
  locale: Locale,
): string {
  if (error) return ''
  if (loading) return feedChromeT(locale, 'loadingPosts')
  return empty ? `${feedChromeT(locale, 'emptyTitle')} ${feedChromeT(locale, 'emptyBody')}` : ''
}

/**
 * The feed's two always-mounted polite status regions, side by side:
 *   feed-status       the list: loading / empty (filters, order, reloads change it);
 *   feed-card-notice  what the last change from an event card's ⋯ menu did ("Changes saved.").
 * Separate, so a filter or reload never replaces the card notice and the notice never hides the
 * empty state. Both stay empty until `ready` (the viewer's language has settled).
 */
export function FeedStatusRegions({
  ready,
  loading,
  error,
  empty,
  notice,
  locale,
}: {
  ready: boolean
  loading: boolean
  error: boolean
  empty: boolean
  notice: string
  locale: Locale
}) {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only" data-testid="feed-status">
        {ready ? feedStatusAnnouncement({ loading, error, empty }, locale) : ''}
      </p>
      <p role="status" aria-live="polite" className="sr-only" data-testid="feed-card-notice">
        {ready ? notice : ''}
      </p>
    </>
  )
}

/** True from the first frame after `settled` turned true: the status region is mounted empty and
 *  only then speaks, so its first message is announced — once, in the settled language. */
export function useFeedAnnounceReady(settled: boolean): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!settled) return
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [settled])
  return ready
}

/** True once the viewer's language will not change any more: auth has resolved, and a signed-in
 *  viewer's profile read (the profile carries the language) has finished — loaded, failed or timed
 *  out (then the language stays English). Until then useProfileLocale reads 'en', so announcing
 *  earlier could speak English first and the member's language second. */
export function feedLocaleSettled({ authLoading, user, profileSettled }: { authLoading: boolean; user: unknown; profileSettled: boolean }): boolean {
  return !authLoading && (!user || profileSettled)
}

/** The tab a sub-tab-list key moves to (null = not a moving key). ArrowRight / ArrowLeft follow
 *  the reading direction: in a right-to-left locale ArrowLeft moves to the next tab. */
export function nextTabIndex(key: string, current: number, count: number, locale: Locale): number | null {
  const rtl = dir(locale) === 'rtl'
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
  const back = rtl ? 'ArrowRight' : 'ArrowLeft'
  if (key === forward) return (current + 1) % count
  if (key === back) return (current - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

/** The list's place-holder while it has no cards: the read failed (with Retry), is running, or
 *  returned nothing. Loading / empty are announced by the feed's status region (feedStatusAnnouncement),
 *  so their visible copy is hidden from assistive tech. Retry moves focus to the feed title (the
 *  button itself leaves once the read starts). */
export function FeedListStatus({
  state,
  locale,
  onRetry,
  focusTitle,
}: {
  state: FeedListState
  locale: Locale
  onRetry: () => void
  focusTitle: () => void
}) {
  const t = (key: keyof FeedChromeMessages) => feedChromeT(locale, key)
  if (state.kind === 'error') {
    return (
      <div className="text-center py-8">
        <p role="alert" data-testid="feed-load-error" className="text-sm text-red-700">
          {t(state.error === 'timeout' ? 'loadTimeout' : 'loadFailed')}
        </p>
        <button
          type="button"
          onClick={() => {
            onRetry()
            requestAnimationFrame(focusTitle)
          }}
          className="min-h-6 text-sm text-stone-700 underline mt-2"
        >
          {t('retry')}
        </button>
      </div>
    )
  }
  if (state.kind === 'loading') {
    return (
      <div aria-hidden="true" className="text-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" aria-hidden="true" />
        <p className="text-sm">{t('loadingPosts')}</p>
      </div>
    )
  }
  return (
    <div aria-hidden="true" className="text-center py-12 text-muted-foreground">
      <p className="text-sm">{t('emptyTitle')}</p>
      <p className="text-xs mt-1">{t('emptyBody')}</p>
    </div>
  )
}

/** "Load more posts" (while the next page loads: a spinner and "Loading…"). It stays focusable
 *  while busy (aria-disabled) and ignores activation until the page has loaded. */
export function FeedLoadMore({ locale, loading, onLoadMore }: { locale: Locale; loading: boolean; onLoadMore: () => void }) {
  return (
    <div className="pt-2 pb-4 flex justify-center">
      <button
        type="button"
        data-testid="feed-load-more"
        onClick={() => {
          if (!loading) onLoadMore()
        }}
        aria-disabled={loading || undefined}
        className="px-5 py-2 rounded-full text-sm font-medium bg-[#f0ede6] hover:bg-[#e8e4db] text-stone-700 aria-disabled:opacity-60 aria-disabled:cursor-wait flex items-center gap-2 transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            {feedChromeT(locale, 'loadingMore')}
          </>
        ) : (
          feedChromeT(locale, 'loadMore')
        )}
      </button>
    </div>
  )
}
