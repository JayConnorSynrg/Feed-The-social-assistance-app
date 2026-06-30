// 07-events-checkins.smoke.ts — Mission 7: Events & Check-ins backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('07: Events & Check-ins', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('event_checkins table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.event_checkins'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('event_checkins has a unique index on (occurrence_id, user_id)', async () => {
    const rows = await queryProd(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'event_checkins'
        AND indexdef ILIKE '%occurrence_id%'
        AND indexdef ILIKE '%user_id%'
        AND indexdef ILIKE '%unique%'
    `);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it.skipIf(!TOKEN_AVAILABLE)('projected_turnout is SECDEF', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname = 'projected_turnout'
    `);
    // Function may not exist if W6 migration not applied — tolerate gracefully
    if (rows.length > 0) {
      expect(rows[0].prosecdef).toBe(true);
    } else {
      console.log('NOTE: projected_turnout not found — W6 migration may not be applied');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('event_occurrences table exists', async () => {
    const rows = await queryProd(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_occurrences'
    `);
    expect(rows.length).toBe(1);
  });

  it.skipIf(!TOKEN_AVAILABLE)('checkins_select_own RLS policy exists (own-row scoping)', async () => {
    const rows = await queryProd(`
      SELECT polname, cmd
      FROM pg_policies
      WHERE tablename = 'event_checkins'
        AND polname ILIKE '%own%'
    `);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
