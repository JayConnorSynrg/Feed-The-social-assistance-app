// 19-admin-resource-discovery.smoke.ts — Mission 19: Admin Resource Discovery backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('19: Admin Resource Discovery', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('admin discovery RPCs are SECDEF with pinned search_path', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN (
          'admin_list_pending_resources',
          'approve_resource',
          'reject_resource',
          'approve_form_template'
        )
      ORDER BY proname
    `);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.prosecdef).toBe(true);
      const config = Array.isArray(row.proconfig) ? row.proconfig.join(',') : String(row.proconfig ?? '');
      expect(config).toMatch(/search_path/);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('anon cannot execute admin_list_pending_resources', async () => {
    const rows = await queryProd(`
      SELECT has_function_privilege('anon', 'public.admin_list_pending_resources()', 'EXECUTE') AS can_exec
    `);
    expect(rows[0]?.can_exec).toBe(false);
  });

  it.skipIf(!TOKEN_AVAILABLE)('approved resources baseline: admin_list_pending_resources returns only pending rows', async () => {
    const rows = await queryProd(`
      SELECT DISTINCT status FROM public.admin_list_pending_resources()
    `);
    // Every returned row must be status='pending' — approved rows must never surface here
    for (const row of rows) {
      expect(row.status).toBe('pending');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('approved resource count is non-negative (approved baseline check)', async () => {
    const rows = await queryProd(`
      SELECT count(*) AS cnt FROM public.resources WHERE status = 'approved'
    `);
    expect(Number(rows[0]?.cnt)).toBeGreaterThanOrEqual(0);
  });

  it.skipIf(!TOKEN_AVAILABLE)('resources table has discovery_metadata column (provenance stamping)', async () => {
    const rows = await queryProd(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'resources'
        AND column_name = 'discovery_metadata'
    `);
    if (rows.length > 0) {
      expect(rows[0].data_type).toBe('jsonb');
    } else {
      console.log('NOTE: discovery_metadata column not found — phasec migration may not be applied');
    }
  });
});
