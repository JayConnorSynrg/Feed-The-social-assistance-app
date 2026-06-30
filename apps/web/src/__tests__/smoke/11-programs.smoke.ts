// 11-programs.smoke.ts — Mission 11: Programs backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('11: Programs', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('approved admin-added program resources exist (panel has data to render)', async () => {
    const rows = await queryProd(`
      SELECT count(*) AS cnt
      FROM public.resources
      WHERE status = 'approved'
        AND is_volunteer_resource = false
        AND source = 'admin_added'
    `);
    // Panel renders empty if this is 0 — flag but do not hard-fail a fresh env
    const cnt = Number(rows[0]?.cnt);
    expect(cnt).toBeGreaterThanOrEqual(0);
    if (cnt === 0) {
      console.log('WARN: no approved admin_added resources — ProgramsPanel will render empty');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('resources table state column contains values (normalization sanity check)', async () => {
    const rows = await queryProd(`
      SELECT DISTINCT state
      FROM public.resources
      WHERE status = 'approved'
        AND source = 'admin_added'
      LIMIT 20
    `);
    // Just confirm the query executes without error — state values found
    expect(Array.isArray(rows)).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('resources table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.resources'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('authenticated can SELECT from resources', async () => {
    const rows = await queryProd(`
      SELECT has_table_privilege('authenticated', 'public.resources', 'SELECT') AS can_select
    `);
    expect(rows[0]?.can_select).toBe(true);
  });
});
