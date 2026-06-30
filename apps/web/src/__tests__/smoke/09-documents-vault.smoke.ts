// 09-documents-vault.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 09 — Documents & Vault
// Surface: apps/web/src/components/panels/documents-panel.tsx
// Upstream: Auth (M1), Web Crypto | Downstream: Forms (M10)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('09 — Documents & Vault (PROD read-only)', () => {
  it('user-documents storage bucket is private (not public)', async () => {
    // Backend: storage.buckets — user-documents — public=false
    // Surface: use-encrypted-upload.ts:139-141 → documents-panel.tsx
    // Critical: bucket public=false prevents anonymous reads of encrypted blobs
    const rows = await queryProd(`
      SELECT public FROM storage.buckets WHERE id = 'user-documents'
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].public).toBe(false)
  })

  it('user_documents table has no plaintext-name rows for encrypted files', async () => {
    // Backend: encrypted uploads must carry encrypted_original_name (not plaintext)
    // Surface: use-encrypted-upload.ts:206-208 — filename never stored in plaintext
    const rows = await queryProd(`
      SELECT count(*) AS cnt
      FROM user_documents
      WHERE is_encrypted = true AND encrypted_original_name IS NULL
    `)
    expect(rows.length).toBe(1)
    // Zero encrypted rows without an encrypted name
    expect(Number(rows[0].cnt)).toBe(0)
  })

  it('user_secure_profiles holds wrapped DEK (not plaintext)', async () => {
    // Backend: user_secure_profiles — server holds WRAPPED dek only (zero-knowledge)
    // Surface: vault.ts:87,103 — setupVault writes wrapped_dek + dek_iv + encryption_salt
    const rows = await queryProd(`
      SELECT wrapped_dek IS NOT NULL AS wrapped_present
      FROM user_secure_profiles
      LIMIT 1
    `)
    // If any vault rows exist, they must have wrapped_dek set
    if (rows.length > 0) {
      expect(rows[0].wrapped_present).toBe(true)
    }
    // Zero rows is also valid (no vaults set up yet in test env)
  })

  it('user_documents and user_secure_profiles tables have RLS enabled', async () => {
    // Backend: own-row policies on both tables
    // Surface: documents-panel.tsx — users can only access their own files
    const rows = await queryProd(`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE oid IN (
        'public.user_documents'::regclass,
        'public.user_secure_profiles'::regclass
      )
    `)
    expect(rows.length).toBe(2)
    for (const row of rows) {
      expect(row.relrowsecurity, `${row.relname} must have RLS enabled`).toBe(true)
    }
  })
})
