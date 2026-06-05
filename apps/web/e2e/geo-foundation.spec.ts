/**
 * geo-foundation.spec.ts — Phase D2a: Zip-Centroid Geocoding Foundation
 *
 * Tests the DB-level contract of the geocoding trigger and zip_centroids table.
 * There is no new UI for D2a (pure backend infra), so the highest-signal tests
 * verify the trigger behavior directly via the admin client.
 *
 * Scenarios:
 *  1. zip_centroids table has data — spot-check Burlington VT (05401).
 *  2. zip_centroids row count >= 33,000 (full national seed).
 *  3. Fallback geocode: auth user + profile with zip_code + NULL lat/lng →
 *     trigger fills latitude, longitude, and location on INSERT.
 *  4. Precision preservation: auth user + profile with explicit lat/lng →
 *     trigger does NOT clobber provided coordinates; location derived from them.
 *  5. No zip, no coords: profile with neither → location stays NULL.
 *
 * Run:
 *   cd apps/web && npx playwright test e2e/geo-foundation.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test'
import { makeAdminClient } from './helpers/vault-fixture'

// ---------------------------------------------------------------------------
// Test state — collect user IDs for cleanup
// ---------------------------------------------------------------------------

const createdUserIds: string[] = []

async function provisionTestUser(
  admin: ReturnType<typeof makeAdminClient>,
  emailSuffix: string,
): Promise<{ userId: string }> {
  const email = `geo-test-${emailSuffix}-${Date.now()}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'TestPass!1234',
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`provisionTestUser failed: ${error?.message}`)
  }
  createdUserIds.push(data.user.id)
  return { userId: data.user.id }
}

async function cleanupTestUsers(admin: ReturnType<typeof makeAdminClient>) {
  for (const uid of createdUserIds) {
    // Delete profile first (FK), then auth user
    await admin.from('profiles').delete().eq('id', uid)
    await admin.auth.admin.deleteUser(uid)
  }
  createdUserIds.length = 0
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('geo-foundation: zip_centroids + profile geocoding trigger', () => {
  const admin = makeAdminClient()

  test.afterAll(async () => {
    await cleanupTestUsers(admin)
  })

  // ── Test 1: zip_centroids spot-check ─────────────────────────────────────

  test('zip_centroids has Burlington VT (05401) at expected coordinates', async () => {
    const { data, error } = await admin
      .from('zip_centroids')
      .select('zip, lat, lng')
      .eq('zip', '05401')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.zip).toBe('05401')
    // Burlington VT ZCTA centroid: ~44.47°N, ~-73.21°W
    expect(data!.lat).toBeGreaterThan(44.0)
    expect(data!.lat).toBeLessThan(45.0)
    expect(data!.lng).toBeGreaterThan(-74.0)
    expect(data!.lng).toBeLessThan(-73.0)
  })

  test('zip_centroids has ~33,000+ rows (full national seed)', async () => {
    const { count, error } = await admin
      .from('zip_centroids')
      .select('*', { count: 'exact', head: true })

    expect(error).toBeNull()
    // 2020 Census ZCTA file has 33,144 rows
    expect(count).toBeGreaterThanOrEqual(33000)
  })

  // ── Test 2: Fallback geocode (zip present, lat/lng NULL) ─────────────────

  test('trigger fallback: profile with zip_code and NULL lat/lng gets geocoded on INSERT', async () => {
    const { userId } = await provisionTestUser(admin, 'fallback')

    // The auth trigger creates a profile row automatically; update it to set zip + clear lat/lng
    const { data: updated, error: updateErr } = await admin
      .from('profiles')
      .update({ zip_code: '05401', latitude: null, longitude: null })
      .eq('id', userId)
      .select('id, zip_code, latitude, longitude, location')
      .single()

    expect(updateErr).toBeNull()
    expect(updated).not.toBeNull()

    // Trigger should have filled latitude and longitude from zip_centroids
    expect(updated!.latitude).not.toBeNull()
    expect(updated!.longitude).not.toBeNull()

    // Coordinates should be in the Burlington VT range
    expect(updated!.latitude!).toBeGreaterThan(44.0)
    expect(updated!.latitude!).toBeLessThan(45.0)
    expect(updated!.longitude!).toBeGreaterThan(-74.0)
    expect(updated!.longitude!).toBeLessThan(-73.0)

    // location column should be non-null (geography derived from lat/lng)
    expect(updated!.location).not.toBeNull()
  })

  // ── Test 3: Precision preservation ──────────────────────────────────────

  test('trigger precision guard: explicit lat/lng is NOT clobbered by zip_centroids', async () => {
    const { userId } = await provisionTestUser(admin, 'precise')

    // Precise Mapbox fix — intentionally different from the 05401 centroid
    const PRECISE_LAT = 44.4900   // centroid is 44.476621
    const PRECISE_LNG = -73.2150  // centroid is -73.209998

    const { data: updated, error: updateErr } = await admin
      .from('profiles')
      .update({
        zip_code: '05401',
        latitude: PRECISE_LAT,
        longitude: PRECISE_LNG,
      })
      .eq('id', userId)
      .select('id, zip_code, latitude, longitude, location')
      .single()

    expect(updateErr).toBeNull()
    expect(updated).not.toBeNull()

    // Trigger fallback must NOT fire because lat/lng are NOT null
    // The precise coordinates must be preserved exactly
    expect(updated!.latitude).toBeCloseTo(PRECISE_LAT, 4)
    expect(updated!.longitude).toBeCloseTo(PRECISE_LNG, 4)

    // location should be non-null (derived from precise coords)
    expect(updated!.location).not.toBeNull()

    // Re-fetch to confirm the DB stored the precise coords (not the centroid)
    const { data: fetched } = await admin
      .from('profiles')
      .select('latitude, longitude')
      .eq('id', userId)
      .single()

    expect(fetched?.latitude).toBeCloseTo(PRECISE_LAT, 4)
    expect(fetched?.longitude).toBeCloseTo(PRECISE_LNG, 4)
  })

  // ── Test 4: No zip, no coords → location stays NULL ──────────────────────

  test('profile with no zip_code and no coords has NULL location', async () => {
    const { userId } = await provisionTestUser(admin, 'nocoords')

    // Clear any coords set by the auth trigger / default profile creation
    const { data: updated, error: updateErr } = await admin
      .from('profiles')
      .update({ zip_code: null, latitude: null, longitude: null })
      .eq('id', userId)
      .select('id, zip_code, latitude, longitude, location')
      .single()

    expect(updateErr).toBeNull()
    expect(updated).not.toBeNull()
    expect(updated!.latitude).toBeNull()
    expect(updated!.longitude).toBeNull()
    expect(updated!.location).toBeNull()
  })
})
