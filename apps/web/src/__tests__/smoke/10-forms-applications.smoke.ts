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

  it('vault encryption columns exist on form_submissions (M06 — live-confirmed contract)', async () => {
    // Backend: form_submissions — four-column envelope encryption pattern
    //   encrypted_form_data (text), form_data_iv (text),
    //   encrypted_signature_data (text), signature_data_iv (text)
    // Surface: use-vault-form-submission.ts:136-144 SELECT + :258-268 insert/update
    // Live DB confirmed 2026-06-30: all four columns present; no encrypted_data column exists.
    // NOTE: the column is NOT named 'encrypted_data' — that was a false assertion (corrected here).
    const rows = await queryProd(`
      SELECT attname
      FROM pg_attribute
      WHERE attrelid = 'public.form_submissions'::regclass
        AND attname IN (
          'encrypted_form_data',
          'form_data_iv',
          'encrypted_signature_data',
          'signature_data_iv'
        )
        AND NOT attisdropped
      ORDER BY attname
    `)
    const cols = rows.map((r) => r.attname as string)
    expect(cols, 'encrypted_form_data must exist').toContain('encrypted_form_data')
    expect(cols, 'form_data_iv must exist').toContain('form_data_iv')
    expect(cols, 'encrypted_signature_data must exist').toContain('encrypted_signature_data')
    expect(cols, 'signature_data_iv must exist').toContain('signature_data_iv')
  })

  it('petition_signatures table exists with RLS (M07 — e-signature via petition path)', async () => {
    // Backend: petition_signatures — live-confirmed 2026-06-30 (form_signatures does NOT exist;
    // signatures are stored via the four encrypted columns on form_submissions itself).
    // Surface: use-vault-form-submission.ts:542 signatureData submitted alongside formData.
    // The petition_signatures table is the independent petition flow table.
    const existRows = await queryProd(`
      SELECT oid
      FROM pg_class
      WHERE relname = 'petition_signatures'
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `)
    expect(
      existRows.length,
      'petition_signatures table does not exist — petition e-signature flow is broken'
    ).toBe(1)

    if (existRows.length === 1) {
      const rls = await queryProd(`
        SELECT relrowsecurity FROM pg_class WHERE oid = 'public.petition_signatures'::regclass
      `)
      expect(rls[0].relrowsecurity, 'petition_signatures must have RLS enabled').toBe(true)
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
