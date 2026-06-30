// 15-reviews-harmony.smoke.ts — Mission 15: Reviews & Harmony backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('15: Reviews & Harmony', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('submit_review and recompute_harmony are SECDEF with pinned search_path', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('submit_review', 'recompute_harmony')
      ORDER BY proname
    `);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(row.prosecdef).toBe(true);
      const config = Array.isArray(row.proconfig) ? row.proconfig.join(',') : String(row.proconfig ?? '');
      expect(config).toMatch(/search_path/);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('anon cannot execute submit_review (forge protection)', async () => {
    const rows = await queryProd(`
      SELECT has_function_privilege('anon', 'public.submit_review(integer, boolean, text, uuid)', 'EXECUTE') AS can_exec
    `);
    expect(rows[0]?.can_exec).toBe(false);
  });

  it.skipIf(!TOKEN_AVAILABLE)('harmony_score and harmony_reviews_count have NO UPDATE grant for anon/authenticated (forge protection via pg_attribute.attacl)', async () => {
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

  it.skipIf(!TOKEN_AVAILABLE)('reviews table has no INSERT policy (writes only via SECDEF submit_review)', async () => {
    const rows = await queryProd(`
      SELECT cmd, polname
      FROM pg_policies
      WHERE tablename = 'reviews'
        AND cmd = 'INSERT'
    `);
    expect(rows).toHaveLength(0);
  });

  it.skipIf(!TOKEN_AVAILABLE)('reviews table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.reviews'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });
});
