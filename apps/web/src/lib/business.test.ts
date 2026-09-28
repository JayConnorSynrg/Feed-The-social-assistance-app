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
  timeToMinutes,
  minuteToClock,
  formatHoursInterval,
  computeOpenNow,
  formatOpenNow,
  type Business,
  type BusinessHours,
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
    zip_code: null,
    phone: null,
    email: null,
    website: null,
    business_category: null,
    cost_model: null,
    service_radius_miles: null,
    attributes: {},
    social_links: {},
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

function hrs(day: number, open: string, close: string): BusinessHours {
  return { day_of_week: day, open_time: open, close_time: close }
}
// Minute-of-week for a local day/hour/minute (0 = Sunday).
function mow(day: number, hour: number, minute = 0): number {
  return day * 1440 + hour * 60 + minute
}

describe('timeToMinutes / minuteToClock / formatHoursInterval', () => {
  it('parses HH:MM and HH:MM:SS, rejecting malformed / out-of-range', () => {
    expect(timeToMinutes('09:00')).toBe(540)
    expect(timeToMinutes('17:30')).toBe(1050)
    expect(timeToMinutes('09:00:00')).toBe(540)
    expect(timeToMinutes('24:00')).toBeNull()
    expect(timeToMinutes('09:60')).toBeNull()
    expect(timeToMinutes('nope')).toBeNull()
    expect(timeToMinutes(null)).toBeNull()
  })
  it('formats a 12-hour clock with AM/PM and midday/midnight edges', () => {
    expect(minuteToClock(540)).toBe('9:00 AM')
    expect(minuteToClock(1020)).toBe('5:00 PM')
    expect(minuteToClock(0)).toBe('12:00 AM')
    expect(minuteToClock(720)).toBe('12:00 PM')
  })
  it('formats an interval label and omits a malformed row', () => {
    expect(formatHoursInterval(hrs(1, '09:00', '17:00'))).toBe('9:00 AM – 5:00 PM')
    expect(formatHoursInterval(hrs(1, '09:00', 'bad'))).toBeNull()
  })
})

describe('computeOpenNow / formatOpenNow (W3 open-now, viewer-local minute-of-week)', () => {
  it('no hours → null (pill renders nothing)', () => {
    expect(computeOpenNow([], mow(1, 12))).toBeNull()
    expect(formatOpenNow(null)).toBeNull()
  })

  it('open inside a same-day interval reports the close time', () => {
    const state = computeOpenNow([hrs(1, '09:00', '17:00')], mow(1, 12))
    expect(state).toEqual({ open: true, closeDay: 1, closeMinute: 1020 })
    expect(formatOpenNow(state)).toBe('Open now · closes 5:00 PM')
  })

  it('closed before opening reports the next open on the same day', () => {
    const state = computeOpenNow([hrs(1, '09:00', '17:00')], mow(1, 8))
    expect(state).toEqual({ open: false, openDay: 1, openMinute: 540 })
    expect(formatOpenNow(state)).toBe('Closed · opens Mon 9:00 AM')
  })

  it('closed after the last interval wraps to next week', () => {
    const state = computeOpenNow([hrs(1, '09:00', '17:00')], mow(1, 18))
    expect(state).toEqual({ open: false, openDay: 1, openMinute: 540 })
    expect(formatOpenNow(state)).toBe('Closed · opens Mon 9:00 AM')
  })

  it('an interval crossing midnight keeps the business open past 00:00', () => {
    // Friday 22:00 → 02:00; now is Saturday 01:00 → still open, closes 2:00 AM.
    const state = computeOpenNow([hrs(5, '22:00', '02:00')], mow(6, 1))
    expect(state).toEqual({ open: true, closeDay: 6, closeMinute: 120 })
    expect(formatOpenNow(state)).toBe('Open now · closes 2:00 AM')
  })

  it('a Saturday→Sunday interval covers the earliest minutes of Sunday (week wrap)', () => {
    // Removing the +MINUTES_PER_WEEK probe makes this case report Closed instead of Open.
    const state = computeOpenNow([hrs(6, '22:00', '02:00')], mow(0, 1))
    expect(state).toEqual({ open: true, closeDay: 0, closeMinute: 120 })
  })

  it('a zero-length interval (open === close) contributes nothing', () => {
    expect(computeOpenNow([hrs(1, '09:00', '09:00')], mow(1, 12))).toBeNull()
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
