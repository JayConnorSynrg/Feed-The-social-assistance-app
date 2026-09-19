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
import {
  isApproximateGeocode, PRECISE_GEOCODE_TIERS,
  needsLocation, LOCATION_ERROR_ACCURACY, buildTierHistogram,
} from './geocode-accuracy'

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

  it('treats the unlocated sentinel as approximate (never a solid pin)', () => {
    expect(isApproximateGeocode(LOCATION_ERROR_ACCURACY)).toBe(true)
  })
})

describe('needsLocation — W1 location-error state', () => {
  it('is true ONLY for the unlocated sentinel', () => {
    expect(needsLocation(LOCATION_ERROR_ACCURACY)).toBe(true)
    expect(LOCATION_ERROR_ACCURACY).toBe('unlocated')
  })

  it.each(['rooftop', 'parcel', 'point', 'approximate', 'interpolated', '', null, undefined])(
    'is false for %s',
    (acc) => {
      expect(needsLocation(acc as string | null | undefined)).toBe(false)
    }
  )
})

describe('buildTierHistogram — unlocated bucket', () => {
  it('counts unlocated rows in their own bucket, not "other"', () => {
    const h = buildTierHistogram([
      { geocode_accuracy: 'unlocated' },
      { geocode_accuracy: 'unlocated' },
      { geocode_accuracy: 'rooftop' },
    ])
    expect(h.unlocated).toBe(2)
    expect(h.rooftop).toBe(1)
    expect(h.other).toBe(0)
  })
})
