// apps/web/src/lib/business.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Mutation-proven unit tests for the two load-bearing pure helpers behind the P4a business
// surfaces. Cases are chosen to go RED if the invariant clause is removed or inverted.

import { describe, it, expect } from 'vitest'
import {
  dedupeResourcesForBusinesses,
  businessLinkedResourceIds,
  bucketForKm,
  parseGeographyPoint,
  sortByDistanceKm,
  nextSubmitPhase,
  type Business,
} from './business'

function biz(id: string, resource_id: string | null): Business {
  return {
    id,
    name: id,
    description: null,
    org_type: 'business',
    address: null,
    city: null,
    state: null,
    phone: null,
    website: null,
    location: null,
    resource_id,
  }
}

describe('dedupeResourcesForBusinesses (CINV2 — ONE PIN)', () => {
  const resources = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]

  it('drops the resource a business already renders as its leaf', () => {
    // b1 links r1 → r1 must NOT survive (else it renders twice: leaf + resource pin).
    const out = dedupeResourcesForBusinesses(resources, [biz('b1', 'r1')])
    expect(out.map((r) => r.id)).toEqual(['r2', 'r3'])
  })

  it('a business without resource_id removes nothing', () => {
    const out = dedupeResourcesForBusinesses(resources, [biz('b1', null)])
    expect(out.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
  })

  it('drops every linked resource across multiple businesses', () => {
    const out = dedupeResourcesForBusinesses(resources, [biz('b1', 'r1'), biz('b2', 'r3')])
    expect(out.map((r) => r.id)).toEqual(['r2'])
  })

  it('no businesses → all resources survive (never over-filters)', () => {
    const out = dedupeResourcesForBusinesses(resources, [])
    expect(out.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
  })

  it('businessLinkedResourceIds collects only non-null ids', () => {
    const set = businessLinkedResourceIds([biz('b1', 'r1'), biz('b2', null), biz('b3', 'r2')])
    expect([...set].sort()).toEqual(['r1', 'r2'])
  })
})

describe('bucketForKm — mirrors the server distance_bucket vocabulary', () => {
  it('maps each range to the fixed bucket string', () => {
    expect(bucketForKm(0.5)).toBe('<2km')
    expect(bucketForKm(1.99)).toBe('<2km')
    expect(bucketForKm(2)).toBe('2-10km')
    expect(bucketForKm(9.99)).toBe('2-10km')
    expect(bucketForKm(10)).toBe('10-50km')
    expect(bucketForKm(49.99)).toBe('10-50km')
    expect(bucketForKm(50)).toBe('>50km')
  })
  it('null / NaN → unknown', () => {
    expect(bucketForKm(null)).toBe('unknown')
    expect(bucketForKm(undefined)).toBe('unknown')
    expect(bucketForKm(NaN)).toBe('unknown')
  })
})

describe('parseGeographyPoint', () => {
  it('reads GeoJSON coordinates', () => {
    expect(parseGeographyPoint({ coordinates: [-72.5, 44.2] })).toEqual({ lng: -72.5, lat: 44.2 })
  })
  it('returns null for missing / short input', () => {
    expect(parseGeographyPoint(null)).toBeNull()
    expect(parseGeographyPoint('abcd')).toBeNull()
    expect(parseGeographyPoint({})).toBeNull()
  })
  it('decodes an EWKB little-endian point', () => {
    // Build EWKB for POINT(-72 44), SRID 4326, little-endian.
    const buf = new Uint8Array(25)
    const view = new DataView(buf.buffer)
    buf[0] = 1
    view.setUint32(1, 0x20000001, true) // type + SRID flag
    view.setUint32(5, 4326, true)
    view.setFloat64(9, -72, true)
    view.setFloat64(17, 44, true)
    const hex = [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
    const pt = parseGeographyPoint(hex)
    expect(pt).not.toBeNull()
    expect(pt!.lng).toBeCloseTo(-72, 6)
    expect(pt!.lat).toBeCloseTo(44, 6)
  })
})

describe('sortByDistanceKm', () => {
  it('sorts ascending; unknown distances go last; stable within ties', () => {
    const items = [
      { id: 'a', km: 30 },
      { id: 'b', km: null as number | null },
      { id: 'c', km: 5 },
      { id: 'd', km: 5 },
    ]
    const out = sortByDistanceKm(items, (x) => x.km).map((x) => x.id)
    expect(out).toEqual(['c', 'd', 'a', 'b'])
  })
})

describe('nextSubmitPhase (CINV4 — TRUTHFUL SUBMIT)', () => {
  it('a successful persist becomes pending review — never live/approved', () => {
    const phase = nextSubmitPhase({ ok: true, id: 'org-1' })
    expect(phase).toEqual({ kind: 'pending', id: 'org-1' })
    // Explicitly assert it is NOT treated as already-live.
    expect(phase.kind).not.toBe('approved')
    expect(phase.kind).not.toBe('live')
  })
  it('a failed persist becomes error carrying the message (revert path)', () => {
    const phase = nextSubmitPhase({ ok: false, error: 'insert denied' })
    expect(phase).toEqual({ kind: 'error', message: 'insert denied' })
  })
})
