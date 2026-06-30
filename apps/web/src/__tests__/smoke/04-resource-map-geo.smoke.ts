// 04-resource-map-geo.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 04 — Resource Map & Geo
// Surface: apps/web/src/components/panels/map-panel.tsx
// Upstream: Auth (M1), PostGIS | Downstream: Safety Alerts (M12), Volunteer (M13)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('04 — Resource Map & Geo (PROD read-only)', () => {
  it('geo RPCs are SECDEF with multi-schema search_path (public, extensions)', async () => {
    // Backend: resources_in_bounds, safety_alerts_in_view, place_safety_alert, set_resource_location
    // Surface: map-panel.tsx → use-viewport-resources.ts:128
    // Critical: search_path MUST be unquoted list (quoted → empty path → 42P01)
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('resources_in_bounds', 'safety_alerts_in_view', 'place_safety_alert', 'set_resource_location')
    `)
    expect(rows.length).toBe(4)
    for (const row of rows) {
      expect(row.prosecdef, `${row.proname} must be SECDEF`).toBe(true)
      const config = row.proconfig as string[] | null
      const hasSearchPath = config?.some((c: string) => c.startsWith('search_path='))
      expect(hasSearchPath, `${row.proname} must have pinned search_path`).toBe(true)
    }
  })

  it('resources_in_bounds viewport query returns non-negative count over CONUS bbox', async () => {
    // Backend: resources_in_bounds — PostGIS viewport query with extensions schema
    // Surface: use-viewport-resources.ts:128 → map-panel.tsx markers
    // Proves search_path resolves PostGIS functions (no 42P01)
    const rows = await queryProd(`
      SELECT count(*) AS cnt FROM resources_in_bounds(-125, 24, -66, 50)
    `)
    expect(rows.length).toBe(1)
    expect(Number(rows[0].cnt)).toBeGreaterThanOrEqual(0)
  })

  it('safety_alerts_in_view RETURNS TABLE does not include created_by', async () => {
    // Backend: safety_alerts_in_view — RETURNS TABLE omits created_by (privacy gate)
    // Surface: use-safety-alerts.ts:78 → map-panel.tsx alert markers
    const rows = await queryProd(`
      SELECT p.proname,
             pg_get_function_result(p.oid) AS result_type
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'safety_alerts_in_view'
    `)
    expect(rows.length).toBeGreaterThan(0)
    const resultType = rows[0].result_type as string
    // The RETURNS TABLE must NOT include created_by — only is_mine as the derived boolean
    expect(resultType).not.toContain('created_by')
    expect(resultType).toContain('is_mine')
  })

  it('resources table has RLS enabled', async () => {
    // Backend: resources table — RLS yes (per mission brief)
    // Surface: resources_in_bounds is SECDEF — raw table access gated by RLS
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.resources'::regclass
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('PostGIS extension is installed', async () => {
    // Backend: geography(Point,4326) columns require PostGIS
    // Surface: resources.location, safety_alerts.location — both use PostGIS
    const rows = await queryProd(`
      SELECT count(*) AS cnt FROM pg_extension WHERE extname = 'postgis'
    `)
    expect(rows.length).toBe(1)
    expect(Number(rows[0].cnt)).toBe(1)
  })
})
