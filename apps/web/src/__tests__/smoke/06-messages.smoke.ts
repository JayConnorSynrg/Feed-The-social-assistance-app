// 06-messages.smoke.ts — Mission 6: Messages backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('06: Messages', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('conversations and messages are in supabase_realtime publication', async () => {
    const rows = await queryProd(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND tablename IN ('conversations', 'messages')
    `);
    const tableNames = rows.map((r) => r.tablename);
    expect(tableNames).toContain('conversations');
    expect(tableNames).toContain('messages');
  });

  it.skipIf(!TOKEN_AVAILABLE)('get_my_conversation_counterparties is SECDEF', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname = 'get_my_conversation_counterparties'
    `);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].prosecdef).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('conversations table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.conversations'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('messages table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.messages'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('conversations partial unique index exists (prevents duplicate pending requests)', async () => {
    const rows = await queryProd(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'conversations'
        AND indexdef ILIKE '%pending%'
    `);
    // At least one partial unique index on conversations for the pending-dedup guard
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
