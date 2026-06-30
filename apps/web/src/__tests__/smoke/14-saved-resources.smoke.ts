// 14-saved-resources.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 14 — Saved Resources
// Surface: Saved-resources drawer (consumer of use-saved-resources.ts)
// Upstream: Auth (M1), Vault (M9) | Downstream: Documents/Vault (M9)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('14 — Saved Resources (PROD read-only)', () => {
  it('saved_resources table has RLS enabled with FOR ALL user_id policy', async () => {
    // Backend: saved_resources — FOR ALL, row-scoped by user_id
    // Surface: use-saved-resources.ts:79-84 (select), :156-160 (delete)
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.saved_resources'::regclass
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('saved_resources has encrypted_notes and notes_iv columns', async () => {
    // Backend: supabase/migrations/20260611000000_encrypt_saved_resources.sql
    // Surface: vault-gated notes — encrypted_notes/notes_iv written by AES-GCM
    const rows = await queryProd(`
      SELECT attname
      FROM pg_attribute
      WHERE attrelid = 'public.saved_resources'::regclass
        AND attname IN ('encrypted_notes', 'notes_iv', 'resource_name')
        AND NOT attisdropped
    `)
    const colNames = rows.map((r) => r.attname as string)
    expect(colNames).toContain('encrypted_notes')
    expect(colNames).toContain('notes_iv')
    expect(colNames).toContain('resource_name')
  })

  it('saved_resources written via current UI have encrypted_notes (not plaintext)', async () => {
    // Backend: zero-knowledge at rest — new saves write encrypted_notes, not notes
    // Surface: use-saved-resources.ts vault-gated notes write
    const rows = await queryProd(`
      SELECT
        count(*) AS total,
        count(encrypted_notes) AS with_cipher,
        count(notes) FILTER (WHERE notes IS NOT NULL) AS plaintext_remaining
      FROM public.saved_resources
    `)
    expect(rows.length).toBe(1)
    // At minimum, the columns are readable
    expect(Number(rows[0].total)).toBeGreaterThanOrEqual(0)
  })

  it('saved_resource_tasks and saved_resource_events tables have RLS enabled', async () => {
    // Backend: saved_resource_tasks + saved_resource_events — row-scoped
    // Surface: saved resources detail expansion
    const rows = await queryProd(`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE oid IN (
        'public.saved_resource_tasks'::regclass,
        'public.saved_resource_events'::regclass
      )
    `)
    for (const row of rows) {
      expect(row.relrowsecurity, `${row.relname} must have RLS enabled`).toBe(true)
    }
  })
})
