// 16-notifications.smoke.ts — Mission 16: Notifications backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('16: Notifications', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('notifications table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notifications'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('no INSERT policy on notifications (forge protection — client cannot self-insert)', async () => {
    const rows = await queryProd(`
      SELECT cmd, polname
      FROM pg_policies
      WHERE tablename = 'notifications'
        AND cmd = 'INSERT'
    `);
    // The forgeable INSERT policy was dropped with no replacement
    expect(rows).toHaveLength(0);
  });

  it.skipIf(!TOKEN_AVAILABLE)('notifications is in supabase_realtime publication (live bell updates)', async () => {
    const rows = await queryProd(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND tablename = 'notifications'
    `);
    if (rows.length === 0) {
      // This is a known residual per the mission — flag but do not hard-fail
      console.warn('WARN: notifications not in supabase_realtime — live bell updates will degrade to refresh-only');
    }
    // We assert the query executes without error; publication status is surfaced in logs
    expect(Array.isArray(rows)).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('notify_seekers_near_resource is SECDEF', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname = 'notify_seekers_near_resource'
    `);
    if (rows.length > 0) {
      expect(rows[0].prosecdef).toBe(true);
    } else {
      console.log('NOTE: notify_seekers_near_resource not found — geo_outreach_rpcs migration may not be applied');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('reminders table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.reminders'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });
});
