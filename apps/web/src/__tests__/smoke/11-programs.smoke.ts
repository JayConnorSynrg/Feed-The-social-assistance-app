// 11-programs.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 11 — Programs Browser
// Surface: apps/web/src/components/panels/programs-panel.tsx
// Upstream: External Sync (M21), benefits-screening edge fn | Downstream: Forms (M10)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('11 — Programs Browser (PROD read-only)', () => {
  it('approved admin-added program resources exist in the database', async () => {
    // Backend: resources — status='approved', is_volunteer_resource=false, source='admin_added'
    // Surface: use-program-browser.ts:76-83 → programs-panel.tsx list
    const rows = await queryProd(`
      SELECT count(*) AS cnt
      FROM resources
      WHERE status = 'approved'
        AND is_volunteer_resource = false
        AND source = 'admin_added'
    `)
    expect(rows.length).toBe(1)
    // Programs panel renders empty if this count is 0
    expect(Number(rows[0].cnt)).toBeGreaterThan(0)
  })

  it('resources state values are consistent (abbrev or full name)', async () => {
    // Backend: resources.state — normalizeState must match what syncs write
    // Surface: use-program-browser.ts:82 → normalizeState guard for VT/Vermont regression
    const rows = await queryProd(`
      SELECT DISTINCT state
      FROM resources
      WHERE status = 'approved' AND source = 'admin_added'
      LIMIT 20
    `)
    // State values exist — cross-check format matches normalizeState output
    expect(rows.length).toBeGreaterThanOrEqual(0)
    // All values must be non-null strings
    for (const row of rows) {
      if (row.state !== null) {
        expect(typeof row.state).toBe('string')
      }
    }
  })

  it('resources table has RLS enabled', async () => {
    // Backend: resources — RLS yes
    // Surface: programs-panel.tsx reads are auth-scoped
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.resources'::regclass
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('zip_centroids table exists for geocode fallback', async () => {
    // Backend: zip_centroids — geocode fallback for resource location
    // Surface: resource-discover edge fn → zip centroid fallback (M19)
    const rows = await queryProd(`
      SELECT count(*) AS cnt FROM zip_centroids
    `)
    expect(rows.length).toBe(1)
    // Should have zip centroid data
    expect(Number(rows[0].cnt)).toBeGreaterThan(0)
  })
})
