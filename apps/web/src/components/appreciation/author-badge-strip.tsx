'use client'

// apps/web/src/components/appreciation/author-badge-strip.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Compact strip of the author's TOP 3 public engagement badges (icon + level, level desc),
// rendered on the feed author row after the HarmonyBadge (P2.1b). Levels only — the public
// badge_summary carries no counts. Renders nothing when the author has no public badges.
// Each chip's tooltip and screen-reader text are in the viewer's language
// (lib/i18n-feed-badges.ts); the strip inherits the card's language mark.

import { topBadgesByLevel, levelLabel, type BadgeSummary } from '@/lib/engagement-badges'
import { BadgeGlyph } from '@/components/profile/engagement-badges'
import type { Locale } from '@/lib/i18n'
import { badgeAriaText, badgeTitleText } from '@/lib/i18n-feed-badges'

export function AuthorBadgeStrip({
  summary,
  userId,
  limit = 3,
  locale,
}: {
  summary: BadgeSummary | null | undefined
  userId: string
  limit?: number
  /** The viewer's language. */
  locale: Locale
}) {
  const top = topBadgesByLevel(summary, limit)
  if (top.length === 0) return null
  return (
    <span
      className="inline-flex items-center gap-1"
      data-testid={`author-badge-strip-${userId}`}
    >
      {top.map((b) => (
        <span
          key={`${b.group}:${b.key}`}
          className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5"
          style={{ borderColor: `${b.colorHex}55`, backgroundColor: `${b.colorHex}18`, color: b.colorHex }}
          title={badgeTitleText(b, locale)}
          data-testid={`author-badge-${b.group}-${b.key}`}
        >
          <BadgeGlyph iconName={b.iconName} className="h-3 w-3" />
          <span className="text-[9px] font-semibold leading-none" aria-hidden="true">{levelLabel(b.level)}</span>
          {/* The public strip says the level only (no points). */}
          <span className="sr-only">{badgeAriaText({ group: b.group, key: b.key, label: b.label, level: b.level }, locale)}</span>
        </span>
      ))}
    </span>
  )
}
