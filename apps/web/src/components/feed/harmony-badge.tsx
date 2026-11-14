'use client'

/**
 * harmony-badge.tsx
 *
 * Compact badge that shows a user's aggregate harmony score.
 * Rendered next to author names and seeker names in the opt-in list.
 *
 * score=null / count=0 → renders "New" (no reviews yet).
 * Filled stalks: lime-600 (#65a30d) on amber-50 background — verified WCAG ≥ 4.5:1.
 *
 * In the viewer's language (lib/i18n-feed-badges.ts): the word, the rating's name, and the score
 * and count in the locale's digits. It carries no language mark of its own: it sits inside a card
 * or a sheet that carries the viewer's.
 */

import { WheatStalkRatingDisplay } from '@/components/ui/wheat-stalk-rating'
import type { Locale } from '@/lib/i18n'
import { formatCount, formatFixed } from '@/lib/i18n-intl'
import { badgesT, reviewCountText } from '@/lib/i18n-feed-badges'

interface HarmonyBadgeProps {
  /** Supabase profiles.harmony_score — null when no reviews exist. */
  score: number | null
  /** Supabase profiles.harmony_reviews_count. */
  count: number
  /** The profile's user id — used for the testid. */
  userId: string
  /** The viewer's language. */
  locale: Locale
}

export function HarmonyBadge({ score, count, userId, locale }: HarmonyBadgeProps) {
  const hasReviews = count > 0 && score !== null

  return (
    <span
      data-testid={`harmony-badge-${userId}`}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 border border-amber-200 text-amber-700"
    >
      {hasReviews ? (
        <>
          <WheatStalkRatingDisplay
            value={Math.round(score)}
            size="sm"
            testIdPrefix={`harmony-badge-stalks-${userId}`}
            locale={locale}
          />
          <span>{formatFixed(score, 2, locale)}</span>
          {/* "(12)" for sighted readers; "12 reviews" for a screen reader. */}
          <span className="text-amber-700" aria-hidden="true">({formatCount(count, locale)})</span>
          <span className="sr-only">{reviewCountText(count, locale)}</span>
        </>
      ) : (
        <span>{badgesT(locale, 'harmonyNew')}</span>
      )}
    </span>
  )
}
