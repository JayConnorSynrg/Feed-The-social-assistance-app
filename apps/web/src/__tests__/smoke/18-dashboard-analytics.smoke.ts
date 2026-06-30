// 18-dashboard-analytics.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 18 — Dashboard / Analytics
// Surface: apps/web/src/app/(admin)/moderation/overview-tab.tsx
// Upstream: Auth (M1), admin gate (M17) | Downstream: operator decisions

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('18 — Dashboard & Analytics (PROD read-only)', () => {
  it('all six dashboard RPCs are SECDEF with pinned search_path', async () => {
    // Backend: 6 RPCs fetched in Promise.all by overview-tab.tsx:349-362
    // Surface: overview-tab.tsx metric cards (adoption, resources, petitions, events, fed, profiles)
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN (
          'dashboard_adoption_stats',
          'dashboard_resource_stats',
          'dashboard_petition_momentum',
          'dashboard_event_stats',
          'community_people_fed',
          'dashboard_completed_profiles'
        )
    `)
    expect(rows.length).toBe(6)
    for (const row of rows) {
      expect(row.prosecdef, `${row.proname} must be SECDEF`).toBe(true)
      const config = row.proconfig as string[] | null
      const hasSearchPath = config?.some((c: string) => c.startsWith('search_path='))
      expect(hasSearchPath, `${row.proname} must have pinned search_path`).toBe(true)
    }
  })

  it('anon cannot execute dashboard_adoption_stats', async () => {
    // Backend: dashboard RPCs — admin-gated (anon-exec=false)
    // Surface: overview-tab.tsx — admin-only metrics
    const rows = await queryProd(`
      SELECT has_function_privilege('anon', 'dashboard_adoption_stats()', 'EXECUTE') AS can_exec
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].can_exec).toBe(false)
  })

  it('dashboard_resource_stats returns correct typed shape', async () => {
    // Backend: dashboard_resource_stats() → category, resource_count, active_count
    // Surface: overview-tab.tsx ResourceStat type — guards W5 RPC contract gap (PRs #121-126)
    const rows = await queryProd(`
      SELECT pg_get_function_result(p.oid) AS result_type
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'dashboard_resource_stats'
    `)
    expect(rows.length).toBeGreaterThan(0)
    const resultType = rows[0].result_type as string
    // Must return a TABLE with category, resource_count, active_count
    expect(resultType.toLowerCase()).toContain('category')
    expect(resultType.toLowerCase()).toContain('resource_count')
    expect(resultType.toLowerCase()).toContain('active_count')
  })

  it('admin_list_users RPC is SECDEF', async () => {
    // Backend: admin_list_users — paginated user list with metadata
    // Surface: overview-tab.tsx:362 → user table with ban/delete actions
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND proname = 'admin_list_users'
    `)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].prosecdef).toBe(true)
  })
})
