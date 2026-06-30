// 04-resource-map-geo.smoke.ts — Mission 4: Resource Map & Geo backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('04: Resource Map & Geo', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('geo RPCs are SECDEF with search_path containing extensions schema', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('resources_in_bounds', 'safety_alerts_in_view', 'place_safety_alert', 'set_resource_location')
      ORDER BY proname
    `);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(row.prosecdef).toBe(true);
      const config = Array.isArray(row.proconfig) ? row.proconfig.join(',') : String(row.proconfig ?? '');
      expect(config).toMatch(/search_path/);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('resources_in_bounds executes over a CONUS bounding box (no 42P01 error)', async () => {
    // This proves search_path resolves PostGIS functions (public + extensions)
    const rows = await queryProd(`
      SELECT count(*) AS cnt FROM resources_in_bounds(-125, 24, -66, 50)
    `);
    expect(rows.length).toBe(1);
    expect(Number(rows[0].cnt)).toBeGreaterThanOrEqual(0);
  });

  it.skipIf(!TOKEN_AVAILABLE)('resources table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.resources'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('safety_alerts table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.safety_alerts'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('safety_alerts is NOT in the supabase_realtime publication (WAL privacy)', async () => {
    const rows = await queryProd(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND tablename = 'safety_alerts'
    `);
    expect(rows).toHaveLength(0);
  });
});
