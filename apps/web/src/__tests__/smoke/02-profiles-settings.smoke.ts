// 02-profiles-settings.smoke.ts — Mission 2: Profiles & Settings backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('02: Profiles & Settings', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('profile RPCs are SECDEF with pinned search_path', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc
      WHERE proname IN ('get_my_profile', 'get_my_private_profile', 'get_my_coordinates')
      ORDER BY proname
    `);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.prosecdef).toBe(true);
      expect(Array.isArray(row.proconfig) ? row.proconfig.join(',') : String(row.proconfig ?? '')).toMatch(/search_path/);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('PII columns (full_name, email, phone) are NOT directly SELECT-grantable to anon/authenticated', async () => {
    const rows = await queryProd(`
      SELECT
        a.attname,
        (aclexplode(a.attacl)).grantee::regrole::text AS grantee,
        (aclexplode(a.attacl)).privilege_type AS priv
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'profiles'
        AND a.attname IN ('full_name', 'email', 'phone', 'lat', 'lng')
        AND a.attacl IS NOT NULL
        AND NOT a.attisdropped
    `);
    // No row should show anon or authenticated with SELECT privilege on PII columns
    const leaks = rows.filter(
      (r) =>
        (r.grantee === 'anon' || r.grantee === 'authenticated') &&
        r.priv === 'SELECT'
    );
    expect(leaks).toHaveLength(0);
  });

  it.skipIf(!TOKEN_AVAILABLE)('profiles table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('harmony_score is NOT UPDATE-grantable to authenticated (forge protection)', async () => {
    const rows = await queryProd(`
      SELECT
        a.attname,
        (aclexplode(a.attacl)).grantee::regrole::text AS grantee,
        (aclexplode(a.attacl)).privilege_type AS priv
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'profiles'
        AND a.attname IN ('harmony_score', 'harmony_reviews_count')
        AND a.attacl IS NOT NULL
        AND NOT a.attisdropped
    `);
    const forgeRows = rows.filter(
      (r) =>
        (r.grantee === 'anon' || r.grantee === 'authenticated') &&
        r.priv === 'UPDATE'
    );
    expect(forgeRows).toHaveLength(0);
  });
});
