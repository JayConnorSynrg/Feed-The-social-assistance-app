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
 */

import { useState } from 'react'

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
}

export function WheatStalkRatingInteractive({
  value,
  onChange,
  testIdPrefix = 'stalk',
}: WheatStalkRatingInteractiveProps) {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value

  return (
    <div
      data-testid={`${testIdPrefix}-stalks`}
      role="radiogroup"
      aria-label="Wheat stalk rating"
      className="flex gap-1"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} stalk${n !== 1 ? 's' : ''}`}
          data-testid={`${testIdPrefix}-stalk-${n}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onFocus={() => setHovered(n)}
          onBlur={() => setHovered(0)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault()
              onChange(Math.min(5, value + 1))
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault()
              onChange(Math.max(1, value - 1))
            }
          }}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 rounded"
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
}

export function WheatStalkRatingDisplay({
  value,
  size = 'md',
  testIdPrefix = 'stalk-display',
}: WheatStalkRatingDisplayProps) {
  return (
    <span
      data-testid={`${testIdPrefix}-row`}
      className="inline-flex items-center gap-0.5"
      aria-label={`${value} out of 5 stalks`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <WheatStalk key={n} filled={n <= value} size={size} aria-hidden />
      ))}
    </span>
  )
}
