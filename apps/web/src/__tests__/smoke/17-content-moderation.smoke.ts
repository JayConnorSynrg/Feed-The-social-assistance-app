// 17-content-moderation.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 17 — Content Moderation
// Surface: apps/web/src/app/(admin)/moderation/reports-queue.tsx
// Upstream: Auth (M1), submit_content_report (M5) | Downstream: Community Feed (M5)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('17 — Content Moderation (PROD read-only)', () => {
  it('moderation RPCs are SECDEF with pinned search_path', async () => {
    // Backend: admin_remove_post, admin_hold_post, admin_authorize_post, admin_resolve_report
    // Surface: reports-queue.tsx:136/166/186/206 → rpc bindings
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN (
          'admin_remove_post',
          'admin_hold_post',
          'admin_authorize_post',
          'admin_resolve_report'
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

  it('admin_remove_post exists and anon EXECUTE privilege matches expected', async () => {
    // Backend: admin moderation RPCs — must exist in pg_proc
    // Note: has_function_privilege requires exact arg types; use pg_proc instead for resilience
    // Surface: reports-queue.tsx — admin-only action, gated inside function body
    const rows = await queryProd(`
      SELECT p.proname,
             pg_get_function_identity_arguments(p.oid) AS args,
             p.prosecdef,
             array_agg(g.grantee ORDER BY g.grantee) AS grantees
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      LEFT JOIN information_schema.routine_privileges g
        ON g.routine_name = p.proname
        AND g.specific_schema = 'public'
        AND g.privilege_type = 'EXECUTE'
        AND g.grantee = 'anon'
      WHERE n.nspname = 'public'
        AND p.proname = 'admin_remove_post'
      GROUP BY p.proname, p.oid, p.prosecdef
    `)
    // REAL GAP if this fails: admin_remove_post not deployed
    expect(rows.length, 'admin_remove_post must exist in pg_proc').toBeGreaterThan(0)
    // anon must NOT appear in the grantees list
    const anonGranted = rows.some((r) => {
      const grantees = r.grantees as string[] | null
      return grantees && grantees.includes('anon')
    })
    expect(anonGranted, 'anon must not have EXECUTE on admin_remove_post').toBe(false)
  })

  it('admin_remove_post is SECDEF (admin gate via is_current_user_admin)', async () => {
    // Backend: admin gate enforced inside function body via is_current_user_admin()
    // Surface: reports-queue.tsx — any authenticated caller hits the body; non-admin gets error
    const rows = await queryProd(`
      SELECT p.proname, p.prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'admin_remove_post'
    `)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.prosecdef, 'admin_remove_post must be SECDEF').toBe(true)
    }
  })

  it('content_reports table has only open|dismissed|upheld status values', async () => {
    // Backend: content_reports — status CHECK constraint (open|dismissed|upheld)
    // Surface: reports-queue.tsx → open reports render; closed reports in history
    const rows = await queryProd(`
      SELECT DISTINCT status FROM content_reports
    `)
    const validStatuses = ['open', 'dismissed', 'upheld']
    for (const row of rows) {
      expect(validStatuses).toContain(row.status)
    }
  })

  it('posts table has is_hidden column for soft removal', async () => {
    // Backend: posts.is_hidden — admin_remove_post sets is_hidden=true (soft delete)
    // Surface: feed-panel.tsx → client filters out is_hidden rows (visibility contract)
    const rows = await queryProd(`
      SELECT attname
      FROM pg_attribute
      WHERE attrelid = 'public.posts'::regclass
        AND attname = 'is_hidden'
        AND NOT attisdropped
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].attname).toBe('is_hidden')
  })
})
