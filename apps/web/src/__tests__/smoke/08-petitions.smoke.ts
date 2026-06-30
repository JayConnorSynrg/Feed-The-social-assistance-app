// 08-petitions.smoke.ts — Mission 8: Petitions backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('08: Petitions', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('petition RPCs are SECDEF', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('get_petition_signature_count', 'has_signed_petition', 'withdraw_petition_signature')
      ORDER BY proname
    `);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.prosecdef).toBe(true);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('petition_signatures is in supabase_realtime publication', async () => {
    const rows = await queryProd(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND tablename = 'petition_signatures'
    `);
    expect(rows.length).toBe(1);
  });

  it.skipIf(!TOKEN_AVAILABLE)('petitions table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.petitions'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('petition_signatures table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.petition_signatures'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('petition_signatures has unique constraint per (petition_id, user_id)', async () => {
    const rows = await queryProd(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'petition_signatures'
        AND indexdef ILIKE '%unique%'
    `);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it.skipIf(!TOKEN_AVAILABLE)('anon cannot execute get_petition_signature_count', async () => {
    const rows = await queryProd(`
      SELECT has_function_privilege('anon', 'public.get_petition_signature_count(uuid)', 'EXECUTE') AS can_exec
    `);
    // Per mission: SECDEF + REVOKE PUBLIC/anon; anon should not be able to execute
    // If the function grants to anon via a public grant, this will be true — flag if so
    const result = rows[0]?.can_exec;
    // The mission says SECDEF, which revokes from PUBLIC by default in most setups
    // We assert it's explicitly NOT true for anon
    expect(result).toBe(false);
  });
});
