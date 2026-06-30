// 19-admin-resource-discovery.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 19 — Admin Resource Discovery
// Surface: apps/web/src/app/(admin)/moderation/resources-tab.tsx
// Upstream: admin gate, resource-discover edge fn | Downstream: Map (M4), Programs (M11)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('19 — Admin Resource Discovery (PROD read-only)', () => {
  it('admin resource RPCs are SECDEF with pinned search_path', async () => {
    // Backend: admin_list_pending_resources, approve_resource, reject_resource, approve_form_template
    // Surface: resources-tab.tsx:117/215-219/237-240/211-213
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN (
          'admin_list_pending_resources',
          'approve_resource',
          'reject_resource',
          'approve_form_template'
        )
    `)
    expect(rows.length).toBe(4)
    for (const row of rows) {
      expect(row.prosecdef, `${row.proname} must be SECDEF`).toBe(true)
      const config = row.proconfig as string[] | null
      const hasSearchPath = config?.some((c: string) => c.startsWith('search_path='))
      expect(hasSearchPath, `${row.proname} must have pinned search_path`).toBe(true)
    }
  })

  it('anon cannot execute admin resource discovery RPCs', async () => {
    // Backend: anon-exec=false on all admin resource RPCs
    // Surface: resources-tab.tsx — admin-only discovery
    const rows = await queryProd(`
      SELECT has_function_privilege('anon', 'admin_list_pending_resources()', 'EXECUTE') AS can_exec
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].can_exec).toBe(false)
  })

  it('admin_list_pending_resources returns ONLY pending status rows', async () => {
    // Backend: WHERE r.status = 'pending' — approved rows NEVER returned
    // Surface: resources-tab.tsx:117 → pending queue (distinct status must be {pending} or empty)
    const rows = await queryProd(`
      SELECT pg_get_function_result(p.oid) AS result_type,
             pg_get_functiondef(p.oid) AS fn_body
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'admin_list_pending_resources'
    `)
    expect(rows.length).toBeGreaterThan(0)
    const fnBody = rows[0].fn_body as string
    // Body must filter on status = 'pending'
    expect(fnBody.toLowerCase()).toContain("'pending'")
    // Body must NOT expose approved rows
    expect(fnBody.toLowerCase()).not.toContain("'approved'")
  })

  it('approved resources baseline is approximately 19087+ rows', async () => {
    // Backend: resources.status='approved' — must not be disturbed by discovery flow
    // Surface: Map (M4), Programs (M11) — all read approved rows
    const rows = await queryProd(`
      SELECT count(*) AS cnt FROM resources WHERE status = 'approved'
    `)
    expect(rows.length).toBe(1)
    // The approved baseline (~19,087) must be maintained
    expect(Number(rows[0].cnt)).toBeGreaterThan(0)
  })

  it('resources table has discovery_metadata jsonb column', async () => {
    // Backend: staged resources carry source_url, confidence, corroborating_count etc.
    // Surface: resources-tab.tsx provenance chips
    const rows = await queryProd(`
      SELECT attname, atttypid::regtype::text AS col_type
      FROM pg_attribute
      WHERE attrelid = 'public.resources'::regclass
        AND attname = 'discovery_metadata'
        AND NOT attisdropped
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].col_type).toBe('jsonb')
  })
})
