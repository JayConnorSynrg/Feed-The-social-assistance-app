// 20-federation.smoke.ts — Mission 20: Federation backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC
// NOTE: Expected prod state is zero peers — all probes are read-only dormant-state checks.

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('20: Federation (dormant — 0 peers expected)', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('federation_peers count is 0 (dormant by decision)', async () => {
    const rows = await queryProd(`
      SELECT count(*) AS cnt FROM public.federation_peers
    `);
    const cnt = Number(rows[0]?.cnt);
    expect(cnt).toBe(0);
    // Zero is PASS for the current decision-state per Mission 20 §6
  });

  it.skipIf(!TOKEN_AVAILABLE)('federated_resources count is 0 (dormant — no active peer sync)', async () => {
    const rows = await queryProd(`
      SELECT count(*) AS cnt FROM public.federated_resources
    `);
    expect(Number(rows[0]?.cnt)).toBe(0);
  });

  it.skipIf(!TOKEN_AVAILABLE)('calculate_trust_score and trust_score_to_level are SECDEF', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('calculate_trust_score', 'trust_score_to_level')
      ORDER BY proname
    `);
    if (rows.length > 0) {
      for (const row of rows) {
        expect(row.prosecdef).toBe(true);
      }
    } else {
      console.log('NOTE: federation trust RPCs not found — federation migration may not be applied');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('federation_peers table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.federation_peers'::regclass
    `);
    // Table may not exist if migration deferred
    if (rows.length > 0) {
      expect(rows[0]?.relrowsecurity).toBe(true);
    } else {
      console.log('NOTE: federation_peers table not found');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('federated_instances local row exists or table is present', async () => {
    const rows = await queryProd(`
      SELECT count(*) AS cnt FROM public.federated_instances WHERE is_local = true
    `);
    // 0 = self-registration deferred; 1 = local instance registered
    const cnt = Number(rows[0]?.cnt);
    expect(cnt).toBeLessThanOrEqual(1);
    console.log(`Local federated_instances rows: ${cnt}`);
  });
});
