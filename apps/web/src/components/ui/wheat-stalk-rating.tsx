'use client'

/**
 * wheat-stalk-rating.tsx
 *
 * Inline-SVG wheat stalk rendered ×5 as a rating control.
 * Filled stalks use the app's earth-tone lime-600 green;
 * unfilled stalks are stone-300.
 *
 * Two modes:
 *  - interactive: a radio group as the ARIA Authoring Practices describe it, with a pointer
 *    hover preview
 *  - display: read-only, optional size sm
 *
 * The interactive group:
 *  - one tab stop: the checked stalk, or the first when none is checked (roving tabindex);
 *  - an arrow key moves focus to the neighbouring stalk and checks it, wrapping at the ends.
 *    ArrowDown is the next stalk and ArrowUp the previous in every direction; ArrowRight is the
 *    next in a left-to-right locale and ArrowLeft the next in a right-to-left one (the stalks run
 *    in reading order);
 *  - Space (or a click) checks the focused stalk;
 *  - the filled stalks always show the checked value after a key press. Only a pointer previews.
 * Names are in the viewer's language (lib/i18n-feed-badges.ts); the group is named by the
 * caller's visible caption.
 */

import { useRef, useState } from 'react'
import { dir, type Locale } from '@/lib/i18n'
import { ratingText, stalksText } from '@/lib/i18n-feed-badges'

/** The highest rating. */
export const MAX_STALKS = 5

/** Which neighbour an arrow key moves to: +1 the next stalk, -1 the previous, 0 any other key. */
export function ratingKeyStep(key: string, locale: Locale): -1 | 0 | 1 {
  const rtl = dir(locale) === 'rtl'
  if (key === 'ArrowDown' || key === (rtl ? 'ArrowLeft' : 'ArrowRight')) return 1
  if (key === 'ArrowUp' || key === (rtl ? 'ArrowRight' : 'ArrowLeft')) return -1
  return 0
}

/** The stalk one step from `from`, wrapping at both ends (5 → 1, 1 → 5). */
export function ratingNeighbour(from: number, step: -1 | 1): number {
  return ((from - 1 + step + MAX_STALKS) % MAX_STALKS) + 1
}

/** The group's one tab stop: the checked stalk, or the first when none is checked. */
export function ratingTabStop(value: number): number {
  return value >= 1 && value <= MAX_STALKS ? value : 1
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
  /** The id of the visible caption that names the group. */
  labelledBy: string
  /** True when a rating must be chosen before the form can be sent. */
  required?: boolean
}

export function WheatStalkRatingInteractive({
  value,
  onChange,
  testIdPrefix = 'stalk',
  locale,
  labelledBy,
  required = false,
}: WheatStalkRatingInteractiveProps) {
  // A pointer preview only: focus never sets it, and a key press clears it.
  const [hovered, setHovered] = useState(0)
  const display = hovered || value
  const stalks = useRef<Array<HTMLButtonElement | null>>([])
  const tabStop = ratingTabStop(value)

  return (
    <div
      data-testid={`${testIdPrefix}-stalks`}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-required={required || undefined}
      className="flex gap-1"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          ref={(el) => {
            stalks.current[n - 1] = el
          }}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={stalksText(n, locale)}
          tabIndex={n === tabStop ? 0 : -1}
          data-testid={`${testIdPrefix}-stalk-${n}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onKeyDown={(e) => {
            const step = ratingKeyStep(e.key, locale)
            if (step === 0) return
            e.preventDefault()
            // Focus moves with the check, so what is focused, checked and filled are one stalk.
            const next = ratingNeighbour(n, step)
            setHovered(0)
            onChange(next)
            stalks.current[next - 1]?.focus()
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
