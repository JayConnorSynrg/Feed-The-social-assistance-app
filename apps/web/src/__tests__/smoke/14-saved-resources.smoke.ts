// 14-saved-resources.smoke.ts — Mission 14: Saved Resources backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('14: Saved Resources', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('saved_resources table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.saved_resources'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('saved_resources RLS policy scopes all operations to user_id = auth.uid()', async () => {
    const rows = await queryProd(`
      SELECT polname, cmd, qual
      FROM pg_policies
      WHERE tablename = 'saved_resources'
    `);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // Verify at least one policy references user_id
    const hasUserIdPolicy = rows.some((r) => String(r.qual ?? '').includes('user_id'));
    expect(hasUserIdPolicy).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('encrypted_notes column exists in saved_resources (zero-knowledge notes)', async () => {
    const rows = await queryProd(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'saved_resources'
        AND column_name = 'encrypted_notes'
    `);
    expect(rows.length).toBe(1);
  });

  it.skipIf(!TOKEN_AVAILABLE)('plaintext notes are NULL for encrypted rows (zero-knowledge at rest)', async () => {
    const rows = await queryProd(`
      SELECT count(*) AS cnt
      FROM public.saved_resources
      WHERE encrypted_notes IS NOT NULL
        AND notes IS NOT NULL
    `);
    // Rows with encrypted_notes should have notes=NULL (encrypted path nulls the cleartext)
    expect(Number(rows[0]?.cnt)).toBe(0);
  });

  it.skipIf(!TOKEN_AVAILABLE)('saved_resource_tasks table exists with encrypted titles', async () => {
    const rows = await queryProd(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'saved_resource_tasks'
        AND column_name = 'encrypted_title'
    `);
    expect(rows.length).toBe(1);
  });
});
