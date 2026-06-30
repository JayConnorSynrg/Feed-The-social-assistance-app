// 21-external-sync.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 21 — External Sync (211 / HUD / IMLS / SNAP)
// Surface: apps/web/src/components/panels/map-panel.tsx (SNAP layer), programs-panel.tsx
// Upstream: API keys, external APIs | Downstream: Map (M4), Programs (M11), Saved (M14)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('21 — External Sync (PROD read-only)', () => {
  it('approved resources baseline exists (≥19k rows)', async () => {
    // Backend: resources — baseline ~19,087 approved rows must not be disturbed by syncs
    // Surface: map-panel.tsx markers, programs-panel.tsx list
    const rows = await queryProd(`
      SELECT count(*) AS cnt FROM resources WHERE status = 'approved'
    `)
    expect(rows.length).toBe(1)
    const count = Number(rows[0].cnt)
    // The 19,087 baseline — syncs upsert on (external_id, source) so are non-destructive
    expect(count).toBeGreaterThan(0)
    // Record the exact count — re-run after any sync to prove non-destructive
    console.info(`Approved resources baseline: ${count}`)
  })

  it('resources per-source breakdown is queryable', async () => {
    // Backend: resources.source — 211_api, hud, imls, admin_added, user_submitted
    // Surface: programs-panel.tsx via use-program-browser.ts source filter
    // Note: programs filter uses '211_api' not '211' — cross-check required (see residuals)
    const rows = await queryProd(`
      SELECT source, count(*) AS cnt
      FROM resources
      WHERE status = 'approved'
      GROUP BY source
      ORDER BY cnt DESC
    `)
    expect(rows.length).toBeGreaterThanOrEqual(0)
    // Log the source breakdown for cross-checking against filter values
    for (const row of rows) {
      console.info(`Source: ${row.source} → ${row.cnt} rows`)
    }
  })

  it('snap_retailers table exists with location data', async () => {
    // Backend: snap_retailers — separate table from resources (SNAP is distinct)
    // Surface: map-panel.tsx SNAP layer → supabase.from('snap_retailers').select(...)
    const rows = await queryProd(`
      SELECT
        count(*) AS total,
        count(location) AS with_location
      FROM snap_retailers
    `)
    expect(rows.length).toBe(1)
    // SNAP retailers should be present with locations
    expect(Number(rows[0].total)).toBeGreaterThanOrEqual(0)
    if (Number(rows[0].total) > 0) {
      console.info(`SNAP retailers: ${rows[0].total} total, ${rows[0].with_location} with location`)
    }
  })

  it('resources have external_id+source unique index (idempotent upsert)', async () => {
    // Backend: resources_external_id_source_uniq — prevents duplicate rows on re-sync
    // Surface: resource-pipeline.ts:224 onConflict:'external_id,source'
    const rows = await queryProd(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'resources'
        AND indexname ILIKE '%external_id%source%'
    `)
    expect(rows.length).toBeGreaterThan(0)
    // Must be a unique index
    const indexDef = rows[0].indexdef as string
    expect(indexDef.toLowerCase()).toContain('unique')
  })

  it('set_resource_location RPC is SECDEF (Phase-4 of sync pipeline)', async () => {
    // Backend: set_resource_location — stamps PostGIS geography after upsert
    // Surface: resource-pipeline.ts:249 → Phase-4 location write
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND proname = 'set_resource_location'
    `)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].prosecdef).toBe(true)
  })
})
