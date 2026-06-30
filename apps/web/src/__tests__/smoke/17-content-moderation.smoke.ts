// 17-content-moderation.smoke.ts — Mission 17: Content Moderation backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('17: Content Moderation', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('admin post-action RPCs are SECDEF with pinned search_path', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('admin_remove_post', 'admin_hold_post', 'admin_authorize_post', 'admin_resolve_report')
      ORDER BY proname
    `);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const row of rows) {
      expect(row.prosecdef).toBe(true);
      const config = Array.isArray(row.proconfig) ? row.proconfig.join(',') : String(row.proconfig ?? '');
      expect(config).toMatch(/search_path/);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('anon cannot execute admin_remove_post', async () => {
    const rows = await queryProd(`
      SELECT has_function_privilege('anon', 'public.admin_remove_post(uuid)', 'EXECUTE') AS can_exec
    `);
    expect(rows[0]?.can_exec).toBe(false);
  });

  it.skipIf(!TOKEN_AVAILABLE)('authenticated can execute admin_remove_post (admin gate is in-body, not grant layer)', async () => {
    const rows = await queryProd(`
      SELECT has_function_privilege('authenticated', 'public.admin_remove_post(uuid)', 'EXECUTE') AS can_exec
    `);
    // authenticated can execute (in-body is_current_user_admin() gates; grant layer allows execution)
    expect(rows[0]?.can_exec).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('content_reports table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.content_reports'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('content_reports status values are only open/dismissed/upheld', async () => {
    const rows = await queryProd(`
      SELECT DISTINCT status FROM public.content_reports
    `);
    const statuses = rows.map((r) => r.status);
    for (const s of statuses) {
      expect(['open', 'dismissed', 'upheld']).toContain(s);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('posts table carries is_hidden column (soft-remove support)', async () => {
    const rows = await queryProd(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'posts'
        AND column_name = 'is_hidden'
    `);
    expect(rows.length).toBe(1);
  });
});
