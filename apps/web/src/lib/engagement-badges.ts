// apps/web/src/lib/engagement-badges.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure, framework-agnostic mapping from the server-maintained
// profiles.badge_summary jsonb (see supabase/migrations/20261005000000) to a
// sorted, render-ready display list. No React imports here so it is unit-testable
// in the node environment (see engagement-badges.test.ts). The icon is returned as
// a name string; the render layer maps it to a lucide-react component.

import { CATEGORY_META } from './resource-categories'

/** One dimension's earned state. The PUBLIC summary carries LEVELS ONLY (no `count` — a
 *  privacy floor); the PRIVATE summary also carries `count` for the owner. */
export interface BadgeEntry {
  count?: number
  level: number
}

/** The shape of profiles.badge_summary. Only level>0 dimensions are present. */
export interface BadgeSummary {
  families?: Record<string, BadgeEntry>
  badges?: Record<string, BadgeEntry>
  updated_at?: string
}

export type BadgeGroup = 'family' | 'community'

export interface DisplayBadge {
  group: BadgeGroup
  key: string
  label: string
  level: number
  /** Present only for PRIVATE badges (public badges publish levels only). */
  count?: number
  /** Hex color for the badge accent (from CATEGORY_META where applicable). */
  colorHex: string
  /** lucide-react icon name; mapped to a component in the render layer. */
  iconName: string
}

// The 10 category families match the post-type-wizard chips. Each maps to a
// representative resource_category for its color (CATEGORY_META) and a lucide icon.
export const FAMILY_META: Record<
  string,
  { label: string; category: keyof typeof CATEGORY_META; iconName: string }
> = {
  food: { label: 'Food', category: 'food', iconName: 'Apple' },
  housing: { label: 'Housing', category: 'housing', iconName: 'Home' },
  goods: { label: 'Goods', category: 'clothing', iconName: 'ShoppingBag' },
  transit: { label: 'Transit', category: 'transportation', iconName: 'Bus' },
  health: { label: 'Health', category: 'healthcare', iconName: 'HeartPulse' },
  money: { label: 'Money', category: 'financial', iconName: 'DollarSign' },
  care: { label: 'Care', category: 'childcare', iconName: 'HeartHandshake' },
  education: { label: 'Education', category: 'education', iconName: 'GraduationCap' },
  work: { label: 'Work', category: 'employment', iconName: 'Briefcase' },
  legal: { label: 'Legal', category: 'legal', iconName: 'Scale' },
}

// The 5 community-support badges. Earth-tone accents (WCAG-checked against a light
// card) plus a distinct lucide icon.
export const COMMUNITY_META: Record<
  string,
  { label: string; colorHex: string; iconName: string }
> = {
  helper: { label: 'Helper', colorHex: '#4a5d23', iconName: 'HandHeart' },
  connector: { label: 'Connector', colorHex: '#8a6d3b', iconName: 'Users' },
  voice: { label: 'Voice', colorHex: '#5a6b8c', iconName: 'MessageCircle' },
  advocate: { label: 'Advocate', colorHex: '#8a3b3b', iconName: 'Megaphone' },
  watcher: { label: 'Watcher', colorHex: '#3b6b5a', iconName: 'ShieldAlert' },
  // P2.1b: earned when others send appreciation gifts (public LEVEL only; the giver→
  // receiver edge stays private in appreciation_gifts). Warm amber-brown accent, distinct
  // from connector (#8a6d3b). Without this entry summaryToBadgeList would silently DROP
  // the 'appreciated' key (see the `if (!meta) continue` guard below).
  appreciated: { label: 'Appreciated', colorHex: '#9a6a1f', iconName: 'Gift' },
}

/** Level 1/2/3 -> a short roman-numeral label. */
export function levelLabel(level: number): string {
  return level >= 3 ? 'III' : level === 2 ? 'II' : 'I'
}

/**
 * Convert a badge_summary into a sorted display list. Only earned (level>0)
 * dimensions are shown. Families come first, then community badges; within each,
 * higher level first, then higher count, then label. Returns [] for an empty or
 * missing summary (drives the profile empty state).
 */
export function summaryToBadgeList(summary: BadgeSummary | null | undefined): DisplayBadge[] {
  if (!summary) return []
  const out: DisplayBadge[] = []

  for (const [key, entry] of Object.entries(summary.families ?? {})) {
    if (!entry || entry.level <= 0) continue
    const meta = FAMILY_META[key]
    if (!meta) continue
    out.push({
      group: 'family',
      key,
      label: meta.label,
      level: entry.level,
      count: entry.count,
      colorHex: CATEGORY_META[meta.category]?.hex ?? '#4a5d23',
      iconName: meta.iconName,
    })
  }

  for (const [key, entry] of Object.entries(summary.badges ?? {})) {
    if (!entry || entry.level <= 0) continue
    const meta = COMMUNITY_META[key]
    if (!meta) continue
    out.push({
      group: 'community',
      key,
      label: meta.label,
      level: entry.level,
      count: entry.count,
      colorHex: meta.colorHex,
      iconName: meta.iconName,
    })
  }

  return out.sort((a, b) => {
    if (a.group !== b.group) return a.group === 'family' ? -1 : 1
    if (b.level !== a.level) return b.level - a.level
    if ((b.count ?? 0) !== (a.count ?? 0)) return (b.count ?? 0) - (a.count ?? 0)
    return a.label.localeCompare(b.label)
  })
}

/** True when there is nothing earned to show (profile empty state). */
export function hasNoBadges(summary: BadgeSummary | null | undefined): boolean {
  return summaryToBadgeList(summary).length === 0
}

/**
 * The top `limit` public badges by LEVEL (then count, then label) — the compact strip
 * shown on the feed author row (W P2.1b). Purely level-ranked regardless of family vs
 * community group (unlike summaryToBadgeList, which groups families first). Returns [] for
 * an empty/missing summary so the caller renders nothing. Pure + node-testable.
 */
export function topBadgesByLevel(
  summary: BadgeSummary | null | undefined,
  limit = 3
): DisplayBadge[] {
  return summaryToBadgeList(summary)
    .slice()
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level
      if ((b.count ?? 0) !== (a.count ?? 0)) return (b.count ?? 0) - (a.count ?? 0)
      return a.label.localeCompare(b.label)
    })
    .slice(0, Math.max(0, limit))
}

/** The render-ready view model for a badge section. */
export interface BadgeView {
  /** Publicly-visible earned badges (families + community), sorted. */
  publicBadges: DisplayBadge[]
  /** Owner-only earned badges; always [] unless isOwnProfile. */
  privateBadges: DisplayBadge[]
  /** True when the public list is empty (drives the empty-state copy). */
  showEmptyState: boolean
  /** True when the owner-only private section should render. */
  showPrivateSection: boolean
}

/**
 * Derive the render decisions for a badge section from the raw summaries.
 * Pure and node-testable — the single source of truth shared by the public
 * profile page and the Settings → Profile own-badges surface. Private badges
 * are surfaced only to the owner (isOwnProfile); a non-owner always gets [].
 */
export function deriveBadgeView(
  summary: BadgeSummary | null | undefined,
  privateSummary: BadgeSummary | null | undefined,
  isOwnProfile: boolean
): BadgeView {
  const publicBadges = summaryToBadgeList(summary)
  const privateBadges = isOwnProfile ? summaryToBadgeList(privateSummary) : []
  return {
    publicBadges,
    privateBadges,
    showEmptyState: publicBadges.length === 0,
    showPrivateSection: isOwnProfile && privateBadges.length > 0,
  }
}
