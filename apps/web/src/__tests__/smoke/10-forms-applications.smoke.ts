// 10-forms-applications.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 10 — Forms & Applications
// Surface: apps/web/src/components/panels/forms-panel.tsx
// Upstream: Vault (M9), Auth (M1) | Downstream: Programs (M11)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('10 — Forms & Applications (PROD read-only)', () => {
  it('form_submissions table has RLS enabled (own-row isolation)', async () => {
    // Backend: form_submissions — RLS own-row — no cross-user reads
    // Surface: use-applications.ts:163-173 → forms-panel.tsx list
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.form_submissions'::regclass
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('form_templates table has RLS enabled', async () => {
    // Backend: form_templates — filtered by is_active
    // Surface: forms-panel.tsx:31 → useUserSubmissions reads active templates
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.form_templates'::regclass
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('encrypted_data column exists on form_submissions (vault encryption contract)', async () => {
    // Backend: form_submissions — encrypted_data column for vault-protected submissions
    // Surface: use-vault-form-submission.ts:276-277 — encryptField before insert
    // REAL GAP if this fails: encrypted_data column not deployed → vault form submission broken
    const rows = await queryProd(`
      SELECT attname
      FROM pg_attribute
      WHERE attrelid = 'public.form_submissions'::regclass
        AND attname = 'encrypted_data'
        AND NOT attisdropped
    `)
    expect(
      rows.length,
      'REAL GAP: encrypted_data column missing from form_submissions — vault form encryption is broken'
    ).toBe(1)
  })

  it('form_signatures table exists with RLS (e-signature contract)', async () => {
    // Backend: form_signatures — linked to submission — own-row RLS
    // Surface: forms-panel.tsx e-sign capture → form_signatures insert
    // REAL GAP if this fails: form_signatures table not deployed → e-signature flow broken
    const existRows = await queryProd(`
      SELECT oid
      FROM pg_class
      WHERE relname = 'form_signatures'
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `)
    expect(
      existRows.length,
      'REAL GAP: form_signatures table does not exist — e-signature flow is broken'
    ).toBe(1)

    if (existRows.length === 1) {
      const rls = await queryProd(`
        SELECT relrowsecurity FROM pg_class WHERE oid = 'public.form_signatures'::regclass
      `)
      expect(rls[0].relrowsecurity, 'form_signatures must have RLS enabled').toBe(true)
    }
  })

  it('active form templates exist in the database', async () => {
    // Backend: form_templates — is_active=true records drive the forms panel
    // Surface: forms-panel.tsx template list — empty panel if no active templates
    const rows = await queryProd(`
      SELECT count(*) AS cnt FROM form_templates WHERE is_active = true
    `)
    expect(rows.length).toBe(1)
    // Must have at least one active template for the panel to be functional
    expect(Number(rows[0].cnt)).toBeGreaterThan(0)
  })
})
