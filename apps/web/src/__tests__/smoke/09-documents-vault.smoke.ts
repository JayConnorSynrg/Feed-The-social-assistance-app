// 09-documents-vault.smoke.ts — Mission 9: Documents & Vault backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('09: Documents & Vault', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('user-documents storage bucket is private (public=false)', async () => {
    const rows = await queryProd(`
      SELECT public FROM storage.buckets WHERE id = 'user-documents'
    `);
    expect(rows.length).toBe(1);
    expect(rows[0].public).toBe(false);
  });

  it.skipIf(!TOKEN_AVAILABLE)('user_documents table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.user_documents'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('user_secure_profiles table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.user_secure_profiles'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('encrypted user_documents rows always have encrypted_original_name (no plaintext filename leak)', async () => {
    const rows = await queryProd(`
      SELECT count(*) AS cnt
      FROM public.user_documents
      WHERE is_encrypted = true
        AND encrypted_original_name IS NULL
    `);
    expect(Number(rows[0]?.cnt)).toBe(0);
  });

  it.skipIf(!TOKEN_AVAILABLE)('user_secure_profiles holds wrapped DEK (zero-knowledge — no plaintext dek column)', async () => {
    const rows = await queryProd(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_secure_profiles'
        AND column_name = 'dek'
    `);
    // A plaintext 'dek' column must NOT exist; only 'wrapped_dek' is acceptable
    expect(rows).toHaveLength(0);
  });

  it.skipIf(!TOKEN_AVAILABLE)('storage.objects RLS is enabled for user-documents bucket path', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });
});
