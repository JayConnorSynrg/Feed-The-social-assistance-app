import { describe, expect, it } from 'vitest'
import { classifyV6Feature, type MapboxV6Feature } from './mapbox-geocode-v6'

function feature(
  coords: [number, number] | undefined,
  accuracy: string | undefined,
  confidence: string | undefined,
): MapboxV6Feature {
  return {
    geometry: coords ? { coordinates: coords } : undefined,
    properties: {
      coordinates: { accuracy },
      match_code: { confidence },
    },
  }
}

describe('classifyV6Feature', () => {
  it('tags a rooftop + exact match as precise, keeping the v6 tier and confidence', () => {
    const result = classifyV6Feature(feature([-73.216, 43.611], 'rooftop', 'exact'))
    expect(result).toEqual({ lat: 43.611, lng: -73.216, accuracy: 'rooftop', confidence: 'exact' })
  })

  it('tags a parcel + high match as precise', () => {
    const result = classifyV6Feature(feature([-73.216, 43.611], 'parcel', 'high'))
    expect(result).toEqual({ lat: 43.611, lng: -73.216, accuracy: 'parcel', confidence: 'high' })
  })

  it('tags a place + low match as approximate, preserving the returned coordinate (best-effort placement)', () => {
    const result = classifyV6Feature(feature([-73.216, 43.611], 'place', 'low'))
    expect(result).toEqual({ lat: 43.611, lng: -73.216, accuracy: 'approximate', confidence: 'low' })
  })

  it('tags a precise-tier match with weak confidence as approximate (both dimensions must be strong)', () => {
    const result = classifyV6Feature(feature([-73.216, 43.611], 'rooftop', 'medium'))
    expect(result).toEqual({ lat: 43.611, lng: -73.216, accuracy: 'approximate', confidence: 'medium' })
  })

  it('tags a coarse-tier match with exact confidence as approximate (both dimensions must be strong)', () => {
    const result = classifyV6Feature(feature([-73.216, 43.611], 'interpolated', 'exact'))
    expect(result).toEqual({ lat: 43.611, lng: -73.216, accuracy: 'approximate', confidence: 'exact' })
  })

  it('defaults confidence to low when the feature carries none', () => {
    const result = classifyV6Feature(feature([-73.216, 43.611], 'rooftop', undefined))
    expect(result).toEqual({ lat: 43.611, lng: -73.216, accuracy: 'approximate', confidence: 'low' })
  })

  it('returns null for a feature with no coordinates', () => {
    expect(classifyV6Feature(feature(undefined, 'rooftop', 'exact'))).toBeNull()
  })

  it('returns null for a malformed coordinate pair', () => {
    const malformed: MapboxV6Feature = {
      geometry: { coordinates: [Number.NaN, 43.611] },
      properties: { coordinates: { accuracy: 'rooftop' }, match_code: { confidence: 'exact' } },
    }
    expect(classifyV6Feature(malformed)).toBeNull()
  })

  it('returns null when no feature is passed at all', () => {
    expect(classifyV6Feature(undefined)).toBeNull()
  })
})
