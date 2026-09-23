'use client'

// apps/web/src/components/profile/engagement-badges.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Renders a user's earned engagement badges (from profiles.badge_summary) on the
// public profile page. Pure display: all mapping/sorting lives in
// lib/engagement-badges.ts. Earth-tone styling; WCAG-labelled.

import {
  Apple,
  Home,
  ShoppingBag,
  Bus,
  HeartPulse,
  DollarSign,
  HeartHandshake,
  GraduationCap,
  Briefcase,
  Scale,
  HandHeart,
  Users,
  MessageCircle,
  Megaphone,
  ShieldAlert,
  Sprout,
  type LucideIcon,
} from 'lucide-react'
import {
  summaryToBadgeList,
  levelLabel,
  type BadgeSummary,
  type DisplayBadge,
} from '@/lib/engagement-badges'

const ICONS: Record<string, LucideIcon> = {
  Apple,
  Home,
  ShoppingBag,
  Bus,
  HeartPulse,
  DollarSign,
  HeartHandshake,
  GraduationCap,
  Briefcase,
  Scale,
  HandHeart,
  Users,
  MessageCircle,
  Megaphone,
  ShieldAlert,
}

function BadgePill({ badge }: { badge: DisplayBadge }) {
  const Icon = ICONS[badge.iconName] ?? Sprout
  const groupWord = badge.group === 'family' ? 'category' : 'community'
  return (
    <li
      className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5"
      style={{ borderColor: `${badge.colorHex}55` }}
      data-testid={`engagement-badge-${badge.group}-${badge.key}`}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${badge.colorHex}22`, color: badge.colorHex }}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
      <span className="text-sm font-medium text-stone-800">{badge.label}</span>
      <span
        className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-stone-600"
        aria-hidden="true"
      >
        Lv {levelLabel(badge.level)}
      </span>
      <span className="sr-only">
        {badge.label} {groupWord} badge, level {badge.level}
        {typeof badge.count === 'number' ? `, ${badge.count} points earned` : ''}
      </span>
    </li>
  )
}

export function EngagementBadges({
  summary,
  displayName,
  privateSummary,
  isOwnProfile = false,
}: {
  summary: BadgeSummary | null | undefined
  displayName: string
  /** Owner-only private badges (from user_private_badge_summary); rendered only on own profile. */
  privateSummary?: BadgeSummary | null | undefined
  isOwnProfile?: boolean
}) {
  const badges = summaryToBadgeList(summary)
  const privateBadges = isOwnProfile ? summaryToBadgeList(privateSummary) : []

  return (
    <div className="space-y-4">
      <section aria-labelledby="engagement-badges-heading">
        <h2 id="engagement-badges-heading" className="mb-3 text-sm font-semibold text-stone-500">
          Community Badges
        </h2>
        {badges.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-stone-500">
            <Sprout className="h-4 w-4 text-lime-600" aria-hidden="true" />
            <span>No badges yet — {displayName} earns badges by helping, connecting, and taking part.</span>
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2" data-testid="engagement-badges-list">
            {badges.map((b) => (
              <BadgePill key={`${b.group}:${b.key}`} badge={b} />
            ))}
          </ul>
        )}
      </section>

      {isOwnProfile && privateBadges.length > 0 && (
        <section aria-labelledby="private-badges-heading" data-testid="engagement-private-section">
          <h2 id="private-badges-heading" className="mb-1 text-sm font-semibold text-stone-500">
            Private — only you can see this
          </h2>
          <p className="mb-3 text-xs text-stone-400">
            Credit for the help you receive, and for what you save and bookmark. Not shown to anyone else.
          </p>
          <ul className="flex flex-wrap gap-2" data-testid="engagement-private-list">
            {privateBadges.map((b) => (
              <BadgePill key={`priv:${b.group}:${b.key}`} badge={b} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
