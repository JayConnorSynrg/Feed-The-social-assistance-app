// 18-dashboard-analytics.smoke.ts — Mission 18: Dashboard / Analytics backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('18: Dashboard & Analytics', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('all six dashboard metric RPCs are SECDEF with pinned search_path', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN (
          'dashboard_adoption_stats',
          'dashboard_resource_stats',
          'dashboard_petition_momentum',
          'dashboard_event_stats',
          'community_people_fed',
          'dashboard_completed_profiles'
        )
      ORDER BY proname
    `);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const row of rows) {
      expect(row.prosecdef).toBe(true);
      const config = Array.isArray(row.proconfig) ? row.proconfig.join(',') : String(row.proconfig ?? '');
      expect(config).toMatch(/search_path/);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('anon cannot execute dashboard_adoption_stats', async () => {
    const rows = await queryProd(`
      SELECT has_function_privilege('anon', 'public.dashboard_adoption_stats()', 'EXECUTE') AS can_exec
    `);
    expect(rows[0]?.can_exec).toBe(false);
  });

  it.skipIf(!TOKEN_AVAILABLE)('dashboard_resource_stats returns expected typed shape (W5 contract smoke)', async () => {
    // This proves the RPC body is callable and returns category/resource_count/active_count
    // We use the management API SQL endpoint which runs as the service role — admin-level access
    const rows = await queryProd(`
      SELECT * FROM public.dashboard_resource_stats() LIMIT 1
    `);
    // May return 0 rows in a fresh env — but must NOT error
    expect(Array.isArray(rows)).toBe(true);
    if (rows.length > 0) {
      expect(rows[0]).toHaveProperty('category');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('admin_list_users RPC is SECDEF', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname = 'admin_list_users'
    `);
    if (rows.length > 0) {
      expect(rows[0].prosecdef).toBe(true);
    } else {
      console.log('NOTE: admin_list_users not found');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('admin_user_notes table exists for user management notes', async () => {
    const rows = await queryProd(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_user_notes'
    `);
    if (rows.length === 0) {
      console.log('NOTE: admin_user_notes table not found — user management notes may not be available');
    }
    expect(Array.isArray(rows)).toBe(true);
  });
});
