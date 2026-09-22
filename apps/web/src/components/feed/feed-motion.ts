/**
 * feed-motion.ts
 *
 * W1.5 — pure variant/transition helpers for the community feed's motion
 * micro-interactions. Each helper takes the `useReducedMotion()` flag
 * (boolean | null) and returns plain motion props, so the reduced-motion
 * degradation is a single testable branch rather than JSX-embedded ternaries.
 *
 * Motion is kept to transform / opacity / width only — never a property the
 * existing Tailwind CSS transitions already own (colors stay CSS).
 */

import type { Transition } from 'motion/react'

/** Short enter/exit tween cap for the feed list (≤200ms per the wave spec). */
export const POST_ENTER_MS = 180

/** Poll tally-bar width tween — glides W1.4 live tally updates. */
export const POLL_BAR_MS = 400

/** Heart one-shot pop duration when a post becomes liked. */
export const LIKE_POP_MS = 260

/**
 * Post enter/exit props for the AnimatePresence-wrapped list item.
 * Reduced motion collapses to opacity-only (drops the `y` translate) so
 * content fades but never moves. Exit is always opacity-only (no height —
 * a height exit janks against the `space-y-3` gap).
 */
export function postEnterExit(reduce: boolean | null) {
  return {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: -8 },
    animate: reduce ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit: { opacity: 0 },
    transition: {
      duration: reduce ? 0 : POST_ENTER_MS / 1000,
      ease: 'easeOut',
    } as Transition,
  }
}

/**
 * Poll tally-bar width transition. Reduced motion snaps (duration 0) — the
 * exact pre-W1.5 behavior, so it is a zero-regression degradation.
 */
export function pollBarTransition(reduce: boolean | null): Transition {
  return { duration: reduce ? 0 : POLL_BAR_MS / 1000, ease: 'easeOut' }
}

/**
 * Like-button whileTap value. Reduced motion skips the scale (returns
 * undefined) — the color change still runs via the button's CSS transition.
 */
export function likeTap(reduce: boolean | null): { scale: number } | undefined {
  return reduce ? undefined : { scale: 0.9 }
}
