import { describe, expect, it, vi } from 'vitest'
import {
  classifyV6Feature, parseV6Address, suggestAddressesV6, type MapboxV6Feature,
} from './mapbox-geocode-v6'

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

// A realistic v6 forward-geocode address feature (from the Mapbox v6 docs).
const V6_ADDRESS_FEATURE: MapboxV6Feature = {
  id: 'urn:mbadr:abc',
  geometry: { coordinates: [-77.03655, 38.89768] },
  properties: {
    mapbox_id: 'urn:mbadr:abc',
    feature_type: 'address',
    name: '1600 Pennsylvania Avenue Northwest',
    full_address: '1600 Pennsylvania Avenue Northwest, Washington, District of Columbia 20500, United States',
    place_formatted: 'Washington, District of Columbia 20500, United States',
    coordinates: { accuracy: 'rooftop' },
    match_code: { confidence: 'exact' },
    context: {
      address: { name: '1600 Pennsylvania Avenue Northwest' },
      postcode: { name: '20500' },
      place: { name: 'Washington' },
      region: { name: 'District of Columbia', region_code: 'DC' },
    },
  },
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response
}

describe('parseV6Address', () => {
  it('extracts address_line1 / city / state (region_code) / zip from context', () => {
    expect(parseV6Address(V6_ADDRESS_FEATURE)).toEqual({
      address_line1: '1600 Pennsylvania Avenue Northwest',
      city: 'Washington',
      state: 'DC',
      zip: '20500',
    })
  })

  it('falls back to properties.name for the street line and blanks missing parts', () => {
    const partial: MapboxV6Feature = {
      properties: { name: '5 Main St', context: { place: { name: 'Barre' } } },
    }
    expect(parseV6Address(partial)).toEqual({
      address_line1: '5 Main St', city: 'Barre', state: '', zip: '',
    })
  })

  it('returns all-empty parts for an undefined feature', () => {
    expect(parseV6Address(undefined)).toEqual({ address_line1: '', city: '', state: '', zip: '' })
  })
})

describe('suggestAddressesV6', () => {
  // (a) typing yields suggestions carrying parsed parts + a classified match.
  it('returns suggestions for a query, each with parsed parts and a coordinate match', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ features: [V6_ADDRESS_FEATURE] }))
    const out = await suggestAddressesV6('1600 penn', 'tok', { fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(out).toHaveLength(1)
    expect(out[0].city).toBe('Washington')
    expect(out[0].state).toBe('DC')
    expect(out[0].label).toContain('1600 Pennsylvania')
    expect(out[0].match).toEqual({ lat: 38.89768, lng: -77.03655, accuracy: 'rooftop', confidence: 'exact' })
  })

  it('requests the v6 forward endpoint with autocomplete on and the query encoded', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ features: [] }))
    await suggestAddressesV6('main st', 'tok', { fetchImpl: fetchImpl as unknown as typeof fetch })
    const url = fetchImpl.mock.calls[0][0] as string
    expect(url).toContain('/search/geocode/v6/forward')
    expect(url).toContain('autocomplete=true')
    expect(url).toContain('q=main%20st')
  })

  it('returns [] for a blank query without calling fetch', async () => {
    const fetchImpl = vi.fn()
    expect(await suggestAddressesV6('   ', 'tok', { fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns [] when no token is configured', async () => {
    const fetchImpl = vi.fn()
    expect(await suggestAddressesV6('main', undefined, { fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns [] on a non-OK response (no-results / error, never blocks typing)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false))
    expect(await suggestAddressesV6('main', 'tok', { fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual([])
  })

  it('returns [] when the response carries no features', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ features: [] }))
    expect(await suggestAddressesV6('nowhere', 'tok', { fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual([])
  })

  it('swallows a thrown fetch (network error) and returns []', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network'))
    expect(await suggestAddressesV6('main', 'tok', { fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual([])
  })
})
