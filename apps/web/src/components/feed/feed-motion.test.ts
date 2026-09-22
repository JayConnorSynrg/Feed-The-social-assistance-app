/**
 * feed-motion.test.ts
 *
 * W1.5 — the only pure logic in the motion wave is the reduced-motion branch
 * of the variant helpers. These assert that `reduce === true` degrades every
 * target (opacity-only enter, snapped poll bar, no like pop) and that the
 * default motion path keeps its transform/width animation.
 */

import { describe, it, expect } from 'vitest'
import { postEnterExit, pollBarTransition, likeTap } from './feed-motion'

describe('postEnterExit — enter/exit collapses to opacity-only under reduced motion', () => {
  it('default path translates on the y axis and tweens', () => {
    const p = postEnterExit(false)
    expect(p.initial).toEqual({ opacity: 0, y: -8 })
    expect(p.animate).toEqual({ opacity: 1, y: 0 })
    expect(p.exit).toEqual({ opacity: 0 })
    expect((p.transition as { duration: number }).duration).toBeGreaterThan(0)
  })

  it('reduced motion drops y from initial and animate, keeps opacity', () => {
    const p = postEnterExit(true)
    expect(p.initial).toEqual({ opacity: 0 })
    expect(p.animate).toEqual({ opacity: 1 })
    expect(p.exit).toEqual({ opacity: 0 })
    expect((p.transition as { duration: number }).duration).toBe(0)
  })

  it('treats a null flag (not-yet-resolved matchMedia) as full motion', () => {
    expect(postEnterExit(null).initial).toEqual({ opacity: 0, y: -8 })
  })
})

describe('pollBarTransition — width snaps under reduced motion', () => {
  it('animates the bar with a positive duration by default', () => {
    expect(pollBarTransition(false).duration).toBeGreaterThan(0)
  })

  it('snaps to the final width (duration 0) under reduced motion', () => {
    expect(pollBarTransition(true).duration).toBe(0)
  })
})

describe('likeTap — scale pop is skipped under reduced motion', () => {
  it('returns a shrink scale by default', () => {
    expect(likeTap(false)).toEqual({ scale: 0.9 })
  })

  it('returns undefined (no transform) under reduced motion', () => {
    expect(likeTap(true)).toBeUndefined()
  })
})
