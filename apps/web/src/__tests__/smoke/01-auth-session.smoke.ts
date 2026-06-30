// 01-auth-session.smoke.ts — Mission 1: Auth & Session backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('01: Auth & Session', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set — all tests in this suite will be skipped');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('auth RPCs are SECDEF with pinned search_path', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc
      WHERE proname IN ('get_my_profile', 'get_my_private_profile', 'is_current_user_admin')
      ORDER BY proname
    `);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const row of rows) {
      expect(row.prosecdef).toBe(true);
      expect(Array.isArray(row.proconfig) ? row.proconfig.join(',') : String(row.proconfig ?? '')).toMatch(/search_path/);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('handle_new_user trigger is bound to auth.users', async () => {
    const rows = await queryProd(`
      SELECT tgname, tgrelid::regclass::text AS table_name
      FROM pg_trigger
      WHERE tgname ILIKE '%handle_new_user%'
    `);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const trigger = rows[0];
    expect(String(trigger.table_name ?? '')).toContain('users');
  });

  it.skipIf(!TOKEN_AVAILABLE)('profiles table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'public.profiles'::regclass
    `);
    expect(rows.length).toBe(1);
    expect(rows[0].relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('get_my_profile: anon cannot execute', async () => {
    const rows = await queryProd(`
      SELECT has_function_privilege('anon', 'public.get_my_profile()', 'EXECUTE') AS can_exec
    `);
    expect(rows[0]?.can_exec).toBe(false);
  });

  it.skipIf(!TOKEN_AVAILABLE)('get_my_profile: authenticated can execute', async () => {
    const rows = await queryProd(`
      SELECT has_function_privilege('authenticated', 'public.get_my_profile()', 'EXECUTE') AS can_exec
    `);
    expect(rows[0]?.can_exec).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('is_current_user_admin: anon cannot execute', async () => {
    const rows = await queryProd(`
      SELECT has_function_privilege('anon', 'public.is_current_user_admin()', 'EXECUTE') AS can_exec
    `);
    expect(rows[0]?.can_exec).toBe(false);
  });
});
