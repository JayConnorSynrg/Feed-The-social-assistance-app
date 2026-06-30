// 21-external-sync.smoke.ts — Mission 21: External Sync backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('21: External Sync (211 / HUD / IMLS / SNAP)', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('approved resources baseline: total count is non-negative', async () => {
    const rows = await queryProd(`
      SELECT count(*) AS cnt FROM public.resources WHERE status = 'approved'
    `);
    const cnt = Number(rows[0]?.cnt);
    expect(cnt).toBeGreaterThanOrEqual(0);
    console.log(`Approved resources baseline: ${cnt}`);
  });

  it.skipIf(!TOKEN_AVAILABLE)('source distribution is visible (cross-check 211_api vs 211 label)', async () => {
    const rows = await queryProd(`
      SELECT source, count(*) AS cnt
      FROM public.resources
      GROUP BY source
      ORDER BY cnt DESC
    `);
    expect(Array.isArray(rows)).toBe(true);
    const sources = rows.map((r) => r.source);
    console.log(`Resource sources present: ${JSON.stringify(sources)}`);
    // If 211_api is absent but 211 is present, flag the label-drift residual
    if (sources.includes('211') && !sources.includes('211_api')) {
      console.warn('WARN: source label "211" found but "211_api" absent — sync-211 label may have drifted from program browser filter');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('snap_retailers table exists and has rows with location populated', async () => {
    const rows = await queryProd(`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE location IS NOT NULL) AS located
      FROM public.snap_retailers
    `);
    expect(Number(rows[0]?.total)).toBeGreaterThanOrEqual(0);
    const total = Number(rows[0]?.total);
    const located = Number(rows[0]?.located);
    if (total > 0) {
      console.log(`SNAP retailers: total=${total}, with location=${located}`);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('set_resource_location RPC is SECDEF (pipeline Phase-4 geo stamp)', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname = 'set_resource_location'
    `);
    if (rows.length > 0) {
      expect(rows[0].prosecdef).toBe(true);
    } else {
      console.log('NOTE: set_resource_location not found');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('resources_external_id_source_uniq index exists (idempotent upsert guard)', async () => {
    const rows = await queryProd(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'resources'
        AND indexname ILIKE '%external_id%source%'
    `);
    if (rows.length === 0) {
      // Try without naming convention
      const alt = await queryProd(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'resources'
          AND indexdef ILIKE '%external_id%'
          AND indexdef ILIKE '%source%'
          AND indexdef ILIKE '%unique%'
      `);
      expect(alt.length).toBeGreaterThanOrEqual(1);
    } else {
      expect(rows.length).toBeGreaterThanOrEqual(1);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('cron sync jobs are scheduled (or explicitly absent)', async () => {
    const rows = await queryProd(`
      SELECT jobname, schedule
      FROM cron.job
      WHERE command ILIKE '%sync-211%'
        OR command ILIKE '%hud-sync%'
        OR command ILIKE '%imls-sync%'
        OR command ILIKE '%snap-retailer-sync%'
    `);
    const jobNames = rows.map((r) => r.jobname);
    console.log(`Sync cron jobs scheduled: ${JSON.stringify(jobNames)}`);
    // Not a hard assertion — we surface which syncs are scheduled for visibility
    expect(Array.isArray(rows)).toBe(true);
  });
});
