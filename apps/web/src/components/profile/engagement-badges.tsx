'use client'

// apps/web/src/components/profile/engagement-badges.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Renders a user's earned engagement badges (from profiles.badge_summary) on the
// public profile page. Pure display: all mapping/sorting lives in
// lib/engagement-badges.ts. Earth-tone styling; WCAG-labelled.
//
// In the viewer's language (lib/i18n-feed-badges.ts). The list carries its own language mark: it
// mounts in the author sheet and in the Settings panel, which is still English. The language is
// the `locale` prop when the caller has one, the profile's otherwise. The member's own name is
// shown as written.

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
  Gift,
  Sprout,
  type LucideIcon,
} from 'lucide-react'
import {
  deriveBadgeView,
  levelLabel,
  type BadgeSummary,
  type DisplayBadge,
} from '@/lib/engagement-badges'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, splitMessage } from '@/lib/format-message'
import { badgeAriaText, badgeLabel, badgesT } from '@/lib/i18n-feed-badges'
import { useProfileLocale } from '@/hooks/use-profile-locale'

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
  Gift,
}

/** Resolve a badge iconName to its lucide component (Sprout fallback). Shared by the
 *  compact author-row strip (P2.1b) so the icon set stays in one place. */
export function BadgeGlyph({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = ICONS[iconName] ?? Sprout
  return <Icon className={className} strokeWidth={2.5} aria-hidden="true" />
}

function BadgePill({ badge, locale }: { badge: DisplayBadge; locale: Locale }) {
  const Icon = ICONS[badge.iconName] ?? Sprout
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
      {/* The visible name and level are for sighted readers; the sentence below says both. */}
      <span className="text-sm font-medium text-stone-800" aria-hidden="true">{badgeLabel(badge, locale)}</span>
      <span
        className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-stone-600"
        aria-hidden="true"
      >
        {formatMessage(badgesT(locale, 'levelShort'), { level: levelLabel(badge.level) })}
      </span>
      <span className="sr-only">{badgeAriaText(badge, locale)}</span>
    </li>
  )
}

export function EngagementBadges({
  summary,
  displayName,
  privateSummary,
  isOwnProfile = false,
  locale,
}: {
  summary: BadgeSummary | null | undefined
  displayName: string
  /** Owner-only private badges (from user_private_badge_summary); rendered only on own profile. */
  privateSummary?: BadgeSummary | null | undefined
  isOwnProfile?: boolean
  /** The viewer's language, when the caller has it (the profile's otherwise). */
  locale?: Locale
}) {
  const profileLocale = useProfileLocale()
  const l = locale ?? profileLocale
  const { publicBadges: badges, privateBadges, showEmptyState, showPrivateSection } =
    deriveBadgeView(summary, privateSummary, isOwnProfile)
  const [beforeName, afterName] = splitMessage(badgesT(l, 'badgesEmpty'), 'name')

  return (
    <div lang={l} dir={dir(l)} className="space-y-4" data-testid="engagement-badges">
      <section aria-labelledby="engagement-badges-heading">
        <h2 id="engagement-badges-heading" className="mb-3 text-sm font-semibold text-stone-500">
          {badgesT(l, 'badgesHeading')}
        </h2>
        {showEmptyState ? (
          <p className="flex items-center gap-2 text-sm text-stone-500">
            <Sprout className="h-4 w-4 text-lime-600" aria-hidden="true" />
            <span>
              {beforeName}
              <bdi lang="">{displayName}</bdi>
              {afterName}
            </span>
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2" data-testid="engagement-badges-list">
            {badges.map((b) => (
              <BadgePill key={`${b.group}:${b.key}`} badge={b} locale={l} />
            ))}
          </ul>
        )}
      </section>

      {showPrivateSection && (
        <section aria-labelledby="private-badges-heading" data-testid="engagement-private-section">
          <h2 id="private-badges-heading" className="mb-1 text-sm font-semibold text-stone-500">
            {badgesT(l, 'privateHeading')}
          </h2>
          <p className="mb-3 text-xs text-stone-600">
            {badgesT(l, 'privateBody')}
          </p>
          <ul className="flex flex-wrap gap-2" data-testid="engagement-private-list">
            {privateBadges.map((b) => (
              <BadgePill key={`priv:${b.group}:${b.key}`} badge={b} locale={l} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
