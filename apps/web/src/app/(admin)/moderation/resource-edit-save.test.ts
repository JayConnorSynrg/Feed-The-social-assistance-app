import { describe, expect, it, vi } from 'vitest'
import type { AddressSuggestion, GeocodeMatch } from '@/lib/mapbox-geocode-v6'
import {
  decideGeoWrite, runResourceSave, buildGeocodeEvent, buildSaveEvent,
  buildAutocompleteEvent, changedFieldKeys,
  type EditFormFields, type GeoDecision, type SaveLogger,
} from './resource-edit-save'

// ── Fixtures ──────────────────────────────────────────────────
const ADDR = { address_line1: '1600 Pennsylvania Ave NW', city: 'Washington', state: 'DC', zip_code: '20500' }
const OTHER = { address_line1: '10 Old St', city: 'Barre', state: 'VT', zip_code: '05641' }
const STRONG: GeocodeMatch = { lat: 38.8977, lng: -77.0365, accuracy: 'rooftop', confidence: 'exact' }
const WEAK: GeocodeMatch = { lat: 44.26, lng: -72.58, accuracy: 'approximate', confidence: 'low' }

function suggestion(match: GeocodeMatch | null): AddressSuggestion {
  return { id: 's1', label: 'label', address_line1: ADDR.address_line1, city: ADDR.city, state: ADDR.state, zip: ADDR.zip_code, match }
}

function form(over: Partial<EditFormFields> = {}): EditFormFields {
  return {
    name: 'Food Shelf', description: 'desc', category: 'food',
    address_line1: ADDR.address_line1, city: ADDR.city, state: ADDR.state, zip_code: ADDR.zip_code,
    phone: '555-0100', email: 'a@b.org', website: 'https://x.org',
    status: 'approved', service_mode: 'physical', ...over,
  }
}

// ══════════════════════════════════════════════════════════════
// W1 — ONE geocode rule, every path, both directions (OUTCOME-first)
// ══════════════════════════════════════════════════════════════
describe('decideGeoWrite — W1 one rule, both write paths', () => {
  const neverGeocode = { resolveGeoPoint: vi.fn(async () => { throw new Error('should not be called') }) }

  it('STRONG selection → writes coords + tier, never flags unlocated', async () => {
    const g = await decideGeoWrite(
      { serviceMode: 'physical', form: ADDR, initialAddress: ADDR, initialHasCoords: false, selection: suggestion(STRONG) },
      { resolveGeoPoint: vi.fn() },
    )
    expect(g.lat).toBe(STRONG.lat)
    expect(g.accuracy).toBe('rooftop')
    expect(g.markUnlocated).toBe(false)
    expect(g.outcome).toBe('placed')
  })

  it('WEAK selection → NO coords + markUnlocated (pin never flung)', async () => {
    const g = await decideGeoWrite(
      { serviceMode: 'physical', form: ADDR, initialAddress: ADDR, initialHasCoords: true, selection: suggestion(WEAK) },
      { resolveGeoPoint: vi.fn() },
    )
    expect(g.lat).toBeUndefined()
    expect(g.markUnlocated).toBe(true)
    expect(g.outcome).toBe('unlocated')
    expect(g.reason).toBe('weak_selection')
  })

  it('null-match selection is treated as weak → NO coords + markUnlocated', async () => {
    const g = await decideGeoWrite(
      { serviceMode: 'physical', form: ADDR, initialAddress: ADDR, initialHasCoords: false, selection: suggestion(null) },
      { resolveGeoPoint: vi.fn() },
    )
    expect(g.lat).toBeUndefined()
    expect(g.markUnlocated).toBe(true)
  })

  it('STRONG free-typed forward geocode → writes coords + tier', async () => {
    const resolveGeoPoint = vi.fn(async () => STRONG)
    const g = await decideGeoWrite(
      { serviceMode: 'physical', form: ADDR, initialAddress: OTHER, initialHasCoords: true, selection: null },
      { resolveGeoPoint },
    )
    expect(resolveGeoPoint).toHaveBeenCalledOnce()
    expect(g.lat).toBe(STRONG.lat)
    expect(g.accuracy).toBe('rooftop')
    expect(g.markUnlocated).toBe(false)
    expect(g.outcome).toBe('placed')
  })

  // MUTATION-PROOF (asymmetry fix): the old on-save path placed even an
  // 'approximate' pin. Reverting the isStrongMatch gate in decideGeoWrite (so a
  // weak forward result sets lat/lng) turns this RED.
  it('WEAK free-typed forward geocode → NO coords + markUnlocated (asymmetry fix)', async () => {
    const resolveGeoPoint = vi.fn(async () => WEAK)
    const g = await decideGeoWrite(
      { serviceMode: 'physical', form: ADDR, initialAddress: OTHER, initialHasCoords: false, selection: null },
      { resolveGeoPoint },
    )
    expect(g.lat).toBeUndefined()
    expect(g.lng).toBeUndefined()
    expect(g.markUnlocated).toBe(true)
    expect(g.outcome).toBe('unlocated')
    expect(g.reason).toBe('weak_geocode')
  })

  it('FAILED free-typed forward geocode → NO coords + markUnlocated', async () => {
    const g = await decideGeoWrite(
      { serviceMode: 'physical', form: ADDR, initialAddress: OTHER, initialHasCoords: false, selection: null },
      { resolveGeoPoint: vi.fn(async () => null) },
    )
    expect(g.lat).toBeUndefined()
    expect(g.markUnlocated).toBe(true)
    expect(g.reason).toBe('geocode_failed')
  })

  it('online → skipped, no coords, no flag, no geocode call', async () => {
    const g = await decideGeoWrite(
      { serviceMode: 'online', form: ADDR, initialAddress: ADDR, initialHasCoords: true, selection: null },
      neverGeocode,
    )
    expect(g.outcome).toBe('skipped')
    expect(g.markUnlocated).toBe(false)
    expect(neverGeocode.resolveGeoPoint).not.toHaveBeenCalled()
  })

  it('unchanged address with an existing pin → skipped, no coords, no flag', async () => {
    const g = await decideGeoWrite(
      { serviceMode: 'physical', form: ADDR, initialAddress: ADDR, initialHasCoords: true, selection: null },
      { resolveGeoPoint: vi.fn() },
    )
    expect(g.outcome).toBe('skipped')
    expect(g.markUnlocated).toBe(false)
  })

  it('SAME rule on both paths: weak selection AND weak free-typed both → {no coords, unlocated}', async () => {
    const sel = await decideGeoWrite(
      { serviceMode: 'physical', form: ADDR, initialAddress: ADDR, initialHasCoords: false, selection: suggestion(WEAK) },
      { resolveGeoPoint: vi.fn() },
    )
    const typed = await decideGeoWrite(
      { serviceMode: 'physical', form: ADDR, initialAddress: OTHER, initialHasCoords: false, selection: null },
      { resolveGeoPoint: vi.fn(async () => WEAK) },
    )
    for (const g of [sel, typed]) {
      expect(g.lat).toBeUndefined()
      expect(g.markUnlocated).toBe(true)
      expect(g.outcome).toBe('unlocated')
    }
  })
})

// ══════════════════════════════════════════════════════════════
// W2 — exactly-one save event; failures reach logger.error
// ══════════════════════════════════════════════════════════════
function fakeLogger(): SaveLogger & { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } {
  return { info: vi.fn(), error: vi.fn() }
}
const PLACED: GeoDecision = { lat: 1, lng: 2, accuracy: 'rooftop', confidence: 'exact', markUnlocated: false, outcome: 'placed', source: 'use_selected', addressChanged: true, queryLen: 10, featureCount: 1, geocodeLatencyMs: 5 }
const UNLOCATED: GeoDecision = { markUnlocated: true, outcome: 'unlocated', source: 'geocode_failed', reason: 'geocode_failed', addressChanged: true, queryLen: 10, featureCount: 0, geocodeLatencyMs: 4 }
const base = { p_id: 'r1', p_name: 'n', p_description: 'd', p_category: 'food', p_address_line1: 'a', p_city: 'c', p_state: 'DC', p_zip_code: 'z', p_phone: 'p', p_email: 'e', p_website: 'w', p_status: 'approved', p_service_mode: 'physical' }

describe('runResourceSave — W2 logging', () => {
  it('success → logger.info admin.resource.save; payload carries geo + mark_unlocated; returns row', async () => {
    const logger = fakeLogger()
    const rpc = vi.fn(async (payload: Record<string, unknown>) => {
      // strong write: coords + tier flow into the RPC payload
      expect(payload.p_lat).toBe(1)
      expect(payload.p_geocode_accuracy).toBe('rooftop')
      expect(payload.p_mark_unlocated).toBe(false)
      return { data: [{ id: 'r1' } as never], error: null }
    })
    const row = await runResourceSave(
      { resourceId: 'r1', mode: 'edit', serviceMode: 'physical', basePayload: base, geo: PLACED, changedFields: ['name'] },
      { rpc, logger },
    )
    expect(row).toEqual({ id: 'r1' })
    const saveCalls = logger.info.mock.calls.filter((c) => c[0] === 'admin.resource.save')
    expect(saveCalls).toHaveLength(1)
    expect(saveCalls[0][1]).toMatchObject({ outcome: 'ok', wrote_location: true, mark_unlocated: false, changed_fields: ['name'] })
    expect(saveCalls[0][1]).toHaveProperty('rpc_latency_ms')
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('unlocated write → payload sets p_mark_unlocated true and omits coords', async () => {
    const logger = fakeLogger()
    const rpc = vi.fn(async (payload: Record<string, unknown>) => {
      expect(payload.p_lat).toBeUndefined()
      expect(payload.p_mark_unlocated).toBe(true)
      return { data: [{ id: 'r1' } as never], error: null }
    })
    await runResourceSave(
      { resourceId: 'r1', mode: 'edit', serviceMode: 'physical', basePayload: base, geo: UNLOCATED, changedFields: [] },
      { rpc, logger },
    )
    expect(rpc).toHaveBeenCalledOnce()
  })

  // MUTATION-PROOF: deleting the logger.error call in runResourceSave's catch
  // turns this RED (today the dialog only set a local saveError — no app_logs).
  it('rpc failure → logger.error admin.resource.save AND rethrows', async () => {
    const logger = fakeLogger()
    const boom = new Error('rls denied')
    const rpc = vi.fn(async () => ({ data: null, error: boom }))
    await expect(runResourceSave(
      { resourceId: 'r1', mode: 'edit', serviceMode: 'physical', basePayload: base, geo: PLACED, changedFields: [] },
      { rpc, logger },
    )).rejects.toThrow('rls denied')
    const errCalls = logger.error.mock.calls.filter((c) => c[0] === 'admin.resource.save')
    expect(errCalls).toHaveLength(1)
    expect(errCalls[0][1]).toBe(boom)
    expect(errCalls[0][2]).toMatchObject({ outcome: 'error', reason: 'rls denied' })
  })

  it('approve mode awaits onConfirm AFTER persist; onConfirm throw rethrows', async () => {
    const logger = fakeLogger()
    const order: string[] = []
    const rpc = vi.fn(async () => { order.push('rpc'); return { data: [{ id: 'r1' } as never], error: null } })
    const onConfirm = vi.fn(async () => { order.push('confirm'); throw new Error('approve failed') })
    await expect(runResourceSave(
      { resourceId: 'r1', mode: 'approve', serviceMode: 'physical', basePayload: base, geo: PLACED, changedFields: [] },
      { rpc, onConfirm, logger },
    )).rejects.toThrow('approve failed')
    expect(order).toEqual(['rpc', 'confirm'])
  })
})

// ══════════════════════════════════════════════════════════════
// PRIVACY — event builders log names/counts/latency, never PII values
// ══════════════════════════════════════════════════════════════
describe('event builders — privacy', () => {
  it('geocode + save + autocomplete events carry no address/email/phone/name VALUES', () => {
    const geoEvt = buildGeocodeEvent('r1', 'physical', PLACED)
    const saveEvt = buildSaveEvent('r1', 'edit', PLACED, ['name', 'email'], 12, 'ok')
    const acEvt = buildAutocompleteEvent({ queryLen: 22, resultCount: 5, suggestLatencyMs: 30, outcome: 'suggest' })
    const blob = JSON.stringify([geoEvt, saveEvt, acEvt])
    expect(blob).not.toContain('Pennsylvania')
    expect(blob).not.toContain('a@b.org')
    expect(blob).not.toContain('555-0100')
    expect(blob).not.toContain('Food Shelf')
    // resource_id, field NAMES, counts, lengths, latencies ARE logged
    expect(geoEvt.resource_id).toBe('r1')
    expect(saveEvt).toMatchObject({ changed_fields: ['name', 'email'], fields_changed_count: 2 })
    expect(acEvt).toMatchObject({ query_len: 22, result_count: 5, suggest_latency_ms: 30 })
  })
})

describe('changedFieldKeys', () => {
  it('returns only the KEYS that differ (trim-insensitive), never values', () => {
    const original = { name: 'Food Shelf', phone: '555-0100', city: 'Washington' }
    const changed = changedFieldKeys(original, form({ phone: '555-9999', city: 'Washington ' }))
    expect(changed).toContain('phone')
    expect(changed).not.toContain('city') // only whitespace differs
    expect(changed).not.toContain('name')
  })
})
