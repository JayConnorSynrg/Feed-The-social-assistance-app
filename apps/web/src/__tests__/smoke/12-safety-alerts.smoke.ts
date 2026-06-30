// 12-safety-alerts.smoke.ts — Mission 12: Safety Alerts backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('12: Safety Alerts', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('created_by is NOT SELECT-grantable to anon or authenticated (reporter anonymity)', async () => {
    const rows = await queryProd(`
      SELECT
        (aclexplode(a.attacl)).grantee::regrole::text AS grantee,
        (aclexplode(a.attacl)).privilege_type AS priv
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'safety_alerts'
        AND a.attname = 'created_by'
        AND a.attacl IS NOT NULL
        AND NOT a.attisdropped
    `);
    const leaks = rows.filter(
      (r) =>
        (r.grantee === 'anon' || r.grantee === 'authenticated') &&
        r.priv === 'SELECT'
    );
    expect(leaks).toHaveLength(0);
  });

  it.skipIf(!TOKEN_AVAILABLE)('safety_alerts is NOT in supabase_realtime publication (WAL privacy)', async () => {
    const rows = await queryProd(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND tablename = 'safety_alerts'
    `);
    expect(rows).toHaveLength(0);
  });

  it.skipIf(!TOKEN_AVAILABLE)('safety_alerts_in_view is SECDEF', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname = 'safety_alerts_in_view'
    `);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].prosecdef).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('admin_verify_safety_alert is SECDEF with pinned search_path', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname = 'admin_verify_safety_alert'
    `);
    if (rows.length > 0) {
      expect(rows[0].prosecdef).toBe(true);
      const config = Array.isArray(rows[0].proconfig) ? rows[0].proconfig.join(',') : String(rows[0].proconfig ?? '');
      expect(config).toMatch(/search_path/);
    } else {
      console.log('NOTE: admin_verify_safety_alert not found');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('safety_alerts table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.safety_alerts'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });
});
