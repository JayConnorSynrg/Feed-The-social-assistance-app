'use client'

/**
 * harmony-badge.tsx
 *
 * Compact badge that shows a user's aggregate harmony score.
 * Rendered next to author names and seeker names in the opt-in list.
 *
 * score=null / count=0 → renders "New" (no reviews yet).
 */

interface HarmonyBadgeProps {
  /** Supabase profiles.harmony_score — null when no reviews exist. */
  score: number | null
  /** Supabase profiles.harmony_reviews_count. */
  count: number
  /** The profile's user id — used for the testid. */
  userId: string
}

export function HarmonyBadge({ score, count, userId }: HarmonyBadgeProps) {
  const hasReviews = count > 0 && score !== null

  return (
    <span
      data-testid={`harmony-badge-${userId}`}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 border border-amber-200 text-amber-700"
    >
      {hasReviews ? (
        <>
          <span aria-hidden="true">★</span>
          <span>{score.toFixed(2)}</span>
          <span className="text-amber-500">({count})</span>
        </>
      ) : (
        <span>New</span>
      )}
    </span>
  )
}
