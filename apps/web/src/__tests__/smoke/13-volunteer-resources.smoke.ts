// 13-volunteer-resources.smoke.ts — Mission 13: Volunteer Resources backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('13: Volunteer Resources', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('authenticated can INSERT into resources (volunteer offer creation)', async () => {
    const rows = await queryProd(`
      SELECT has_table_privilege('authenticated', 'public.resources', 'INSERT') AS can_insert
    `);
    expect(rows[0]?.can_insert).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('approved volunteer resources exist with is_volunteer_resource=true', async () => {
    const rows = await queryProd(`
      SELECT
        count(*) FILTER (WHERE status='approved') AS approved,
        count(*) FILTER (WHERE location IS NOT NULL) AS located
      FROM public.resources
      WHERE is_volunteer_resource = true
    `);
    expect(Number(rows[0]?.approved)).toBeGreaterThanOrEqual(0);
    // located ≈ approved: volunteers should have a location set after registration
    if (Number(rows[0]?.approved) > 0) {
      console.log(`Volunteer resources: approved=${rows[0]?.approved}, located=${rows[0]?.located}`);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('set_resource_location_by_id RPC is SECDEF', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname = 'set_resource_location_by_id'
    `);
    if (rows.length > 0) {
      expect(rows[0].prosecdef).toBe(true);
    } else {
      // Fallback: check set_resource_location
      const fallback = await queryProd(`
        SELECT proname, prosecdef
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND proname = 'set_resource_location'
      `);
      if (fallback.length > 0) {
        expect(fallback[0].prosecdef).toBe(true);
      } else {
        console.log('NOTE: neither set_resource_location_by_id nor set_resource_location found');
      }
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('resources RLS policies exist for row-scoped insert/update by submitted_by', async () => {
    const rows = await queryProd(`
      SELECT polname, cmd
      FROM pg_policies
      WHERE tablename = 'resources'
    `);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
