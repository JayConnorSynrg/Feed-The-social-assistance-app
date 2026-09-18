import { describe, expect, it } from 'vitest'
import { bucketAccuracyTier, classifyGeocodeWrite } from './mapbox-v6.ts'

describe('bucketAccuracyTier', () => {
  it('passes through the tracked tiers verbatim', () => {
    expect(bucketAccuracyTier('rooftop')).toBe('rooftop')
    expect(bucketAccuracyTier('parcel')).toBe('parcel')
    expect(bucketAccuracyTier('point')).toBe('point')
    expect(bucketAccuracyTier('interpolated')).toBe('interpolated')
  })

  it('buckets street/place/region/postcode/undefined to approximate', () => {
    expect(bucketAccuracyTier('street')).toBe('approximate')
    expect(bucketAccuracyTier('place')).toBe('approximate')
    expect(bucketAccuracyTier('region')).toBe('approximate')
    expect(bucketAccuracyTier('postcode')).toBe('approximate')
    expect(bucketAccuracyTier(undefined)).toBe('approximate')
  })
})

describe('classifyGeocodeWrite — life-safety move-only-on-strong-match gate', () => {
  it('rooftop + exact -> precise tier, moved=true (mutation-proof: strong match)', () => {
    expect(classifyGeocodeWrite('rooftop', 'exact')).toEqual({ accuracy: 'rooftop', moved: true })
  })

  it('parcel + high -> precise tier, moved=true', () => {
    expect(classifyGeocodeWrite('parcel', 'high')).toEqual({ accuracy: 'parcel', moved: true })
  })

  it('point + exact -> precise tier, moved=true', () => {
    expect(classifyGeocodeWrite('point', 'exact')).toEqual({ accuracy: 'point', moved: true })
  })

  it('point + low confidence -> approximate, moved=false (mutation-proof: weak confidence on strong tier still gates)', () => {
    expect(classifyGeocodeWrite('point', 'low')).toEqual({ accuracy: 'approximate', moved: false })
  })

  it('rooftop + medium confidence -> approximate, moved=false', () => {
    expect(classifyGeocodeWrite('rooftop', 'medium')).toEqual({ accuracy: 'approximate', moved: false })
  })

  it('interpolated + exact -> approximate, moved=false (mutation-proof: coarse tier gates even on strong confidence)', () => {
    expect(classifyGeocodeWrite('interpolated', 'exact')).toEqual({ accuracy: 'approximate', moved: false })
  })

  it('approximate tier + null confidence -> approximate, moved=false', () => {
    expect(classifyGeocodeWrite('approximate', null)).toEqual({ accuracy: 'approximate', moved: false })
  })

  it('rooftop + null confidence -> approximate, moved=false (no confidence never strong-matches)', () => {
    expect(classifyGeocodeWrite('rooftop', null)).toEqual({ accuracy: 'approximate', moved: false })
  })
})
