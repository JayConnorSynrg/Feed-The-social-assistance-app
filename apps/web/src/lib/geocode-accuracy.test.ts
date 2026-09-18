/**
 * geocode-accuracy.test.ts
 *
 * Life-safety render fail-safe guard for isApproximateGeocode.
 *
 * Invariant under test: a pin renders EXACT (solid) if and only if its
 * accuracy is a verified precise tier -- exactly 'rooftop', 'parcel', or
 * 'point'. Every other value -- including NULL, undefined, empty string,
 * and unknown/coarse tiers -- MUST render APPROXIMATE (hollow).
 *
 * The pre-fix implementation short-circuited `accuracy != null` to false,
 * treating untagged rows (null/undefined/'') as EXACT. That is the bug
 * this suite guards against.
 */

import { describe, it, expect } from 'vitest'
import { isApproximateGeocode, PRECISE_GEOCODE_TIERS } from './geocode-accuracy'

describe('isApproximateGeocode', () => {
  it('treats null accuracy as approximate (the core fail-safe fix)', () => {
    expect(isApproximateGeocode(null)).toBe(true)
  })

  it('treats undefined accuracy as approximate', () => {
    expect(isApproximateGeocode(undefined)).toBe(true)
  })

  it('treats empty-string accuracy as approximate', () => {
    expect(isApproximateGeocode('')).toBe(true)
  })

  it.each([...PRECISE_GEOCODE_TIERS])('treats precise tier %s as exact', (tier) => {
    expect(isApproximateGeocode(tier)).toBe(false)
  })

  it.each(['approximate', 'interpolated', 'intersection', 'anything-else'])(
    'treats coarse/unknown tier %s as approximate',
    (tier) => {
      expect(isApproximateGeocode(tier)).toBe(true)
    }
  )
})
