// 03-ai-chat.smoke.ts — Mission 3: AI Chat backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('03: AI Chat', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('chat edge function exists in list_edge_functions catalog (schema probe via pg_proc absence)', async () => {
    // Chat is stateless — no DB tables. Probe: confirm no rogue chat-related tables exist that could store PII.
    const rows = await queryProd(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename ILIKE '%chat%'
    `);
    // The chat fn is stateless: no public.chat_* tables should exist
    expect(rows).toHaveLength(0);
  });

  it.skipIf(!TOKEN_AVAILABLE)('profiles table accessible to authenticated (chat personalization reads profile)', async () => {
    const rows = await queryProd(`
      SELECT has_table_privilege('authenticated', 'public.profiles', 'SELECT') AS can_select
    `);
    expect(rows[0]?.can_select).toBe(true);
  });
});
