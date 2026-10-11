'use client'

/**
 * wheat-stalk-rating.tsx
 *
 * Inline-SVG wheat stalk rendered ×5 as a rating control.
 * Filled stalks use the app's earth-tone lime-600 green;
 * unfilled stalks are stone-300.
 *
 * Two modes:
 *  - interactive: role="radiogroup", keyboard accessible, hover preview
 *  - display: read-only, optional size sm
 *
 * Names are in the viewer's language (lib/i18n-feed-badges.ts). The stalks run in reading order,
 * so in a right-to-left locale ArrowLeft raises the rating and ArrowRight lowers it.
 */

import { useState } from 'react'
import { dir, type Locale } from '@/lib/i18n'
import { badgesT, ratingText, stalksText } from '@/lib/i18n-feed-badges'

/** The highest rating. */
export const MAX_STALKS = 5

/** What an arrow key does to a rating in a locale: +1, -1, or 0 for any other key. */
export function ratingKeyStep(key: string, locale: Locale): -1 | 0 | 1 {
  const rtl = dir(locale) === 'rtl'
  if (key === 'ArrowUp' || key === (rtl ? 'ArrowLeft' : 'ArrowRight')) return 1
  if (key === 'ArrowDown' || key === (rtl ? 'ArrowRight' : 'ArrowLeft')) return -1
  return 0
}

// ---------------------------------------------------------------------------
// Single wheat stalk SVG (stem + spikelets, ~24×28 viewBox)
// ---------------------------------------------------------------------------

function WheatStalk({
  filled,
  size = 'md',
  'aria-hidden': ariaHidden,
}: {
  filled: boolean
  size?: 'sm' | 'md'
  'aria-hidden'?: boolean
}) {
  const dim = size === 'sm' ? 16 : 24
  const color = filled ? '#65a30d' : '#d6d3d1' // lime-600 / stone-300
  return (
    <svg
      width={dim}
      height={Math.round(dim * 1.2)}
      viewBox="0 0 24 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={ariaHidden}
    >
      {/* Stem */}
      <line x1="12" y1="27" x2="12" y2="5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Grain head — 3 pairs of spikelets + tip */}
      {/* Top grain */}
      <ellipse cx="12" cy="5" rx="3" ry="2.2" fill={color} />
      {/* Upper pair */}
      <ellipse cx="8.5" cy="9" rx="2.8" ry="1.8" transform="rotate(-20 8.5 9)" fill={color} />
      <ellipse cx="15.5" cy="9" rx="2.8" ry="1.8" transform="rotate(20 15.5 9)" fill={color} />
      {/* Mid pair */}
      <ellipse cx="7.5" cy="13.5" rx="2.8" ry="1.8" transform="rotate(-25 7.5 13.5)" fill={color} />
      <ellipse cx="16.5" cy="13.5" rx="2.8" ry="1.8" transform="rotate(25 16.5 13.5)" fill={color} />
      {/* Lower pair */}
      <ellipse cx="8.5" cy="18" rx="2.6" ry="1.6" transform="rotate(-20 8.5 18)" fill={color} />
      <ellipse cx="15.5" cy="18" rx="2.6" ry="1.6" transform="rotate(20 15.5 18)" fill={color} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Interactive rating
// ---------------------------------------------------------------------------

interface WheatStalkRatingInteractiveProps {
  value: number
  onChange: (value: number) => void
  /** testid prefix, e.g. "review" → data-testid="review-stalk-3" */
  testIdPrefix?: string
  /** The viewer's language. */
  locale: Locale
}

export function WheatStalkRatingInteractive({
  value,
  onChange,
  testIdPrefix = 'stalk',
  locale,
}: WheatStalkRatingInteractiveProps) {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value

  return (
    <div
      data-testid={`${testIdPrefix}-stalks`}
      role="radiogroup"
      aria-label={badgesT(locale, 'ratingGroupLabel')}
      className="flex gap-1"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={stalksText(n, locale)}
          data-testid={`${testIdPrefix}-stalk-${n}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onFocus={() => setHovered(n)}
          onBlur={() => setHovered(0)}
          onKeyDown={(e) => {
            const step = ratingKeyStep(e.key, locale)
            if (step === 0) return
            e.preventDefault()
            onChange(step > 0 ? Math.min(MAX_STALKS, value + 1) : Math.max(1, value - 1))
          }}
          className="focus:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 rounded"
        >
          <WheatStalk filled={n <= display} aria-hidden />
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Display-only rating
// ---------------------------------------------------------------------------

interface WheatStalkRatingDisplayProps {
  value: number
  size?: 'sm' | 'md'
  testIdPrefix?: string
  /** The viewer's language. */
  locale: Locale
}

export function WheatStalkRatingDisplay({
  value,
  size = 'md',
  testIdPrefix = 'stalk-display',
  locale,
}: WheatStalkRatingDisplayProps) {
  return (
    // An image named by its rating (a name on a plain span is not announced).
    <span
      data-testid={`${testIdPrefix}-row`}
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={ratingText(value, MAX_STALKS, locale)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <WheatStalk key={n} filled={n <= value} size={size} aria-hidden />
      ))}
    </span>
  )
}
