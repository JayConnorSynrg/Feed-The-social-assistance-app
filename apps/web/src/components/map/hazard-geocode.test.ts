import { describe, expect, it } from 'vitest'
import { planHazardGeocode } from './hazard-geocode'
import type { GeocodeMatch } from '@/lib/mapbox-geocode-v6'

const STRONG: GeocodeMatch = { lat: 38.8977, lng: -77.0365, accuracy: 'rooftop', confidence: 'high' }
const APPROXIMATE: GeocodeMatch = { lat: 44.26, lng: -72.58, accuracy: 'approximate', confidence: 'low' }

describe('planHazardGeocode', () => {
  it('moves the pin to the geocoded coordinate on a strong match', () => {
    const decision = planHazardGeocode(STRONG)
    expect(decision.move).toBe(true)
    expect(decision.coords).toEqual({ lng: STRONG.lng, lat: STRONG.lat })
    expect(decision.accuracy).toBe('rooftop')
    expect(decision.confidence).toBe('high')
  })

  it('does not move the pin on an approximate match, but surfaces classification', () => {
    // GATE-REVERT GUARD: an approximate match must NEVER move the hazard pin.
    // If isStrongMatch were inverted or the gate removed (always-move), these
    // assertions fail — proving the move-only-on-strong-match gate is live.
    const decision = planHazardGeocode(APPROXIMATE)
    expect(decision.move).toBe(false)
    expect(decision.coords).toBeUndefined()
    expect(decision.accuracy).toBe('approximate')
    expect(decision.confidence).toBe('low')
  })

  it('does not move the pin when the geocode failed / returned no result', () => {
    const decision = planHazardGeocode(null)
    expect(decision.move).toBe(false)
    expect(decision.coords).toBeUndefined()
    expect(decision.accuracy).toBeUndefined()
    expect(decision.confidence).toBeUndefined()
  })

  it('treats undefined the same as no result — pin stays put', () => {
    const decision = planHazardGeocode(undefined)
    expect(decision.move).toBe(false)
    expect(decision.coords).toBeUndefined()
  })
})
