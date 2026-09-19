import { describe, expect, it } from 'vitest'
import { planSaveGeo, applySuggestion, addressChanged, isStrongMatch } from './resource-edit-geo'
import type { AddressSuggestion, GeocodeMatch } from '@/lib/mapbox-geocode-v6'

const FULL_ADDR = {
  address_line1: '1600 Pennsylvania Ave NW',
  city: 'Washington',
  state: 'DC',
  zip_code: '20500',
}

const STRONG: GeocodeMatch = { lat: 38.8977, lng: -77.0365, accuracy: 'rooftop', confidence: 'exact' }
const WEAK: GeocodeMatch = { lat: 44.26, lng: -72.58, accuracy: 'approximate', confidence: 'low' }

function suggestion(match: GeocodeMatch | null, over: Partial<AddressSuggestion> = {}): AddressSuggestion {
  return {
    id: 's1',
    label: '1600 Pennsylvania Ave NW, Washington, DC 20500',
    address_line1: FULL_ADDR.address_line1,
    city: FULL_ADDR.city,
    state: FULL_ADDR.state,
    zip: FULL_ADDR.zip_code,
    match,
    ...over,
  }
}

describe('planSaveGeo', () => {
  it('skips geocoding entirely for online resources', () => {
    const plan = planSaveGeo({
      serviceMode: 'online', form: FULL_ADDR, initialAddress: FULL_ADDR, initialHasCoords: true, selection: null,
    })
    expect(plan).toEqual({ geocode: false, query: '', source: 'skipped_online' })
  })

  it('skips when there is no usable address', () => {
    const plan = planSaveGeo({
      serviceMode: 'physical',
      form: { address_line1: '', city: '', state: '', zip_code: '' },
      initialAddress: null, initialHasCoords: false, selection: null,
    })
    expect(plan.geocode).toBe(false)
    expect(plan.source).toBe('no_address')
  })

  // (b) selecting a STRONG suggestion sets coords into the save payload.
  // Mutation-proof: dropping `selected` from the use_selected branch flips this RED.
  it('uses a selected STRONG match coords directly, without running a geocode', () => {
    const plan = planSaveGeo({
      serviceMode: 'physical', form: FULL_ADDR, initialAddress: FULL_ADDR,
      initialHasCoords: false, selection: suggestion(STRONG),
    })
    expect(plan.geocode).toBe(false)
    expect(plan.source).toBe('use_selected')
    expect(plan.selected).toEqual(STRONG)
  })

  // (d) a WEAK selection fills text only — no coords, so the existing pin is never moved.
  // Mutation-proof: treating a weak selection as strong would set `selected` and fail this.
  it('does NOT set coords for a selected WEAK (approximate) match — the pin stays put', () => {
    const plan = planSaveGeo({
      serviceMode: 'physical', form: FULL_ADDR, initialAddress: FULL_ADDR,
      initialHasCoords: true, selection: suggestion(WEAK),
    })
    expect(plan.geocode).toBe(false)
    expect(plan.selected).toBeUndefined()
    expect(plan.source).toBe('skipped_weak_match')
  })

  it('treats a selection whose match is null as a weak selection (no coords, no geocode)', () => {
    const plan = planSaveGeo({
      serviceMode: 'physical', form: FULL_ADDR, initialAddress: FULL_ADDR,
      initialHasCoords: true, selection: suggestion(null),
    })
    expect(plan.geocode).toBe(false)
    expect(plan.selected).toBeUndefined()
    expect(plan.source).toBe('skipped_weak_match')
  })

  // (c) free-typed address (no selection), changed since prefill -> on-save geocode runs.
  // Mutation-proof: breaking the free-typed branch (geocode:false) flips this RED.
  it('runs the on-save forward geocode for a free-typed address that changed since prefill', () => {
    const plan = planSaveGeo({
      serviceMode: 'physical',
      form: FULL_ADDR,
      initialAddress: { address_line1: '10 Old St', city: 'Barre', state: 'VT', zip_code: '05641' },
      initialHasCoords: true,
      selection: null,
    })
    expect(plan.geocode).toBe(true)
    expect(plan.source).toBe('mapbox_forward')
    expect(plan.query).toContain('1600 Pennsylvania Ave NW')
    expect(plan.query).toContain('DC')
  })

  it('geocodes a free-typed address that is unchanged but has no existing coords (backfill)', () => {
    const plan = planSaveGeo({
      serviceMode: 'physical', form: FULL_ADDR, initialAddress: FULL_ADDR,
      initialHasCoords: false, selection: null,
    })
    expect(plan.geocode).toBe(true)
    expect(plan.source).toBe('mapbox_forward')
  })

  it('skips geocoding when a free-typed address is unchanged and already has coords', () => {
    const plan = planSaveGeo({
      serviceMode: 'physical', form: FULL_ADDR, initialAddress: FULL_ADDR,
      initialHasCoords: true, selection: null,
    })
    expect(plan.geocode).toBe(false)
    expect(plan.source).toBe('skipped_address_unchanged')
  })
})

describe('applySuggestion', () => {
  it('overwrites the four address fields from the suggestion and leaves other fields intact', () => {
    const form = {
      name: 'Food Shelf', address_line1: 'old', city: 'old', state: 'VT', zip_code: '00000', phone: '555',
    }
    const next = applySuggestion(form, suggestion(STRONG))
    expect(next.address_line1).toBe(FULL_ADDR.address_line1)
    expect(next.city).toBe('Washington')
    expect(next.state).toBe('DC')
    expect(next.zip_code).toBe('20500')
    // untouched
    expect(next.name).toBe('Food Shelf')
    expect(next.phone).toBe('555')
  })
})

describe('addressChanged / isStrongMatch', () => {
  it('detects a changed address field', () => {
    expect(addressChanged(FULL_ADDR, { ...FULL_ADDR, zip_code: '20501' })).toBe(true)
    expect(addressChanged(FULL_ADDR, { ...FULL_ADDR })).toBe(false)
  })

  it('classifies strong vs weak/absent matches', () => {
    expect(isStrongMatch(STRONG)).toBe(true)
    expect(isStrongMatch(WEAK)).toBe(false)
    expect(isStrongMatch(null)).toBe(false)
  })
})
