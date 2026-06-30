// 08-petitions.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 08 — Petitions
// Surface: apps/web/src/components/panels/petitions-panel.tsx
// Upstream: Auth (M1), Realtime | Downstream: Dashboard (M18)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('08 — Petitions (PROD read-only)', () => {
  it('petition_signatures is in supabase_realtime publication', async () => {
    // Backend: supabase/migrations/20260608000200_petitions_and_signatures.sql:141
    // Surface: use-petitions.ts:135-139 → PetitionsPanel live counter
    const rows = await queryProd(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'petition_signatures'
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].tablename).toBe('petition_signatures')
  })

  it('petition signature RPCs are SECDEF', async () => {
    // Backend: get_petition_signature_count (:98), has_signed_petition (:115)
    // Surface: use-petitions.ts:88 (count), :95 (signed check)
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('get_petition_signature_count', 'has_signed_petition', 'withdraw_petition_signature')
    `)
    expect(rows.length).toBe(3)
    for (const row of rows) {
      expect(row.prosecdef, `${row.proname} must be SECDEF`).toBe(true)
    }
  })

  it('petitions and petition_signatures tables have RLS enabled', async () => {
    // Backend: both tables — RLS yes
    // Surface: PetitionsPanel — own signatures visible, admin export gated
    const rows = await queryProd(`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE oid IN ('public.petitions'::regclass, 'public.petition_signatures'::regclass)
    `)
    expect(rows.length).toBe(2)
    for (const row of rows) {
      expect(row.relrowsecurity, `${row.relname} must have RLS enabled`).toBe(true)
    }
  })

  it('petition_signatures has unique constraint preventing double-sign', async () => {
    // Backend: 23505 unique violation on second sign (use-petitions.ts double-sign guard)
    // Surface: /api/petitions/sign route.ts:138 — returns already-signed path
    const rows = await queryProd(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'petition_signatures'
        AND indexdef ILIKE '%unique%'
    `)
    expect(rows.length).toBeGreaterThan(0)
  })
})
