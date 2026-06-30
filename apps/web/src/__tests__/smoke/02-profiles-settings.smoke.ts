// 02-profiles-settings.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 02 — Profiles & Settings
// Surface: apps/web/src/components/panels/settings-panel.tsx
// Upstream: Auth (M1) | Downstream: Map (M4), Chat (M3), Admin (M17-19)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('02 — Profiles & Settings (PROD read-only)', () => {
  it('profile RPCs are SECDEF with pinned search_path', async () => {
    // Backend: get_my_profile, get_my_private_profile, get_my_coordinates
    // Surface: settings-panel.tsx:1066, coordinate display
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('get_my_profile', 'get_my_private_profile', 'get_my_coordinates')
    `)
    expect(rows.length).toBe(3)
    for (const row of rows) {
      expect(row.prosecdef, `${row.proname} must be SECDEF`).toBe(true)
      const config = row.proconfig as string[] | null
      const hasSearchPath = config?.some((c: string) => c.startsWith('search_path='))
      expect(hasSearchPath, `${row.proname} must have pinned search_path`).toBe(true)
    }
  })

  it('core PII columns exist on profiles table', async () => {
    // Backend: profiles table — verify PII columns are present
    // Note: email lives on auth.users, not public.profiles in Supabase
    // Surface: column-grant-audit pattern — attacl is authoritative for column-level grants
    // Note: columns with no specific column grants will have attacl=null (inherits table grant)
    const rows = await queryProd(`
      SELECT attname
      FROM pg_attribute
      WHERE attrelid = 'public.profiles'::regclass
        AND attname IN ('full_name', 'phone', 'location', 'zip')
        AND NOT attisdropped
    `)
    // At least full_name and location must exist (zip and phone may be optional)
    const names = rows.map((r) => r.attname as string)
    expect(names, 'profiles must have full_name column').toContain('full_name')
    expect(names, 'profiles must have location column').toContain('location')
  })

  it('coordinate columns exist on profiles (lat/lng or latitude/longitude)', async () => {
    // Backend: profiles — coordinate fields for PostGIS geo functions
    // Surface: get_my_coordinates SECDEF accessor
    const rows = await queryProd(`
      SELECT attname
      FROM pg_attribute
      WHERE attrelid = 'public.profiles'::regclass
        AND attname IN ('lat', 'lng', 'latitude', 'longitude', 'location')
        AND NOT attisdropped
    `)
    // At least one coordinate column form must exist
    expect(rows.length, 'profiles must have lat/lng or latitude/longitude or location column').toBeGreaterThan(0)
  })

  it('anon does not have SELECT on profiles.full_name via column privilege', async () => {
    // Backend: column-grant — anon must not read full_name
    // Surface: cross-user PII leak prevention (profiles-pii-revoke pattern)
    const rows = await queryProd(`
      SELECT has_column_privilege('anon', 'public.profiles', 'full_name', 'SELECT') AS can_select
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].can_select, 'anon must NOT have SELECT on profiles.full_name').toBe(false)
  })

  it('coordinate columns are restricted from direct authenticated SELECT', async () => {
    // Backend: column-grant hardening — authenticated cannot freely read coordinate data
    // Surface: get_my_coordinates RPC is the only accessor for own coordinates
    // Strategy: check whichever coordinate column exists (lat or latitude)
    const coordRows = await queryProd(`
      SELECT attname
      FROM pg_attribute
      WHERE attrelid = 'public.profiles'::regclass
        AND attname IN ('lat', 'latitude')
        AND NOT attisdropped
      LIMIT 1
    `)

    if (coordRows.length === 0) {
      // No lat/latitude column — check location geometry column instead
      const locationRows = await queryProd(`
        SELECT has_column_privilege('authenticated', 'public.profiles', 'location', 'SELECT') AS can_select
      `)
      expect(locationRows.length).toBe(1)
      expect(locationRows[0].can_select, 'authenticated must NOT have direct SELECT on profiles.location').toBe(false)
      return
    }

    const colName = coordRows[0].attname as string
    const rows = await queryProd(`
      SELECT has_column_privilege('authenticated', 'public.profiles', '${colName}', 'SELECT') AS can_select
    `)
    expect(rows.length).toBe(1)
    // Coordinate column is REVOKEd from authenticated direct SELECT — only SECDEF accessor allowed
    expect(rows[0].can_select, `authenticated must NOT have direct SELECT on profiles.${colName}`).toBe(false)
  })
})
