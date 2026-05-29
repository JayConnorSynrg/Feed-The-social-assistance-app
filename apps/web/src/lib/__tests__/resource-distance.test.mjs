/**
 * Pure-logic smoke test for the map-tile address + distance line
 * (apps/web/src/components/panels/map-panel.tsx).
 *
 * Why an inline mirror: map-panel.tsx is a TSX React component and the repo has
 * no React DOM / TS test transform wired for `node --test` (vitest is absent).
 * Following apps/web/src/hooks/__tests__/use-viewport-resources.race.test.mjs,
 * the three pure functions involved are replicated line-for-line:
 *   - calculateDistance: haversine, R = 6371 (use-geolocation.ts:296-310)
 *   - formatDistance:    km -> imperial string (map-panel.tsx)
 *   - tileLine:          the address + distance string built in the tile render
 *
 * Run: node --test apps/web/src/lib/__tests__/resource-distance.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

function toRad(deg) {
  return deg * (Math.PI / 180)
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function formatDistance(km) {
  const mi = km * 0.621371
  return mi < 0.1 ? `${Math.round((mi * 5280) / 10) * 10} ft` : `${mi.toFixed(1)} mi`
}

// Mirrors the tile render: build address, attach distance from origin, join.
// origin is [lon, lat] | null. Returns the rendered text (or null if nothing).
function tileLine(r, origin) {
  const addr = [r.address_line1, r.city, r.state].filter(Boolean).join(', ')
  const distance = origin
    ? formatDistance(calculateDistance(origin[1], origin[0], r.latitude, r.longitude))
    : undefined
  if (!addr && !distance) return null
  return `${addr}${addr && distance ? ' · ' : ''}${distance ?? ''}`
}

test('address + origin -> "addr · N mi" shape', () => {
  // Burlington VT origin; a resource ~a few miles away.
  const r = {
    address_line1: '123 Main St',
    city: 'Burlington',
    state: 'VT',
    latitude: 44.4,
    longitude: -73.3,
  }
  const origin = [-73.21, 44.47] // [lon, lat]
  const line = tileLine(r, origin)
  assert.match(line, /^.+, .+, [A-Z]{2} · \d+(\.\d)? (mi|ft)$/)
})

test('no origin -> address only (no distance suffix)', () => {
  const r = {
    address_line1: '123 Main St',
    city: 'Burlington',
    state: 'VT',
    latitude: 44.4,
    longitude: -73.3,
  }
  const line = tileLine(r, null)
  assert.equal(line, '123 Main St, Burlington, VT')
})

test('same point -> "0 ft" (no NaN)', () => {
  const r = { address_line1: null, city: null, state: null, latitude: 44.47, longitude: -73.21 }
  const origin = [-73.21, 44.47]
  const line = tileLine(r, origin)
  assert.equal(line, '0 ft')
  assert.ok(!line.includes('NaN'))
})

test('all-null address + origin -> line starts with a digit (distance only)', () => {
  const r = { address_line1: null, city: null, state: null, latitude: 40.0, longitude: -74.0 }
  const origin = [-73.21, 44.47]
  const line = tileLine(r, origin)
  assert.match(line, /^\d/)
})
