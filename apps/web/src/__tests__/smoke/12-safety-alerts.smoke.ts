// 12-safety-alerts.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 12 — Safety Alerts
// Surface: apps/web/src/components/panels/map-panel.tsx, safety-alert-marker.tsx
// Upstream: Map (M4), Auth (M1) | Downstream: Moderation (M17)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('12 — Safety Alerts (PROD read-only)', () => {
  it('safety_alerts is NOT in supabase_realtime publication (WAL privacy gate)', async () => {
    // Backend: safety_alerts DROPPED from realtime — created_by must not transit WAL
    // Surface: supabase/migrations/20260619000400_drop_safety_alerts_from_realtime.sql
    // Critical: if this is in realtime, created_by leaks via the WAL payload
    const rows = await queryProd(`
      SELECT count(*) AS cnt
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'safety_alerts'
    `)
    expect(rows.length).toBe(1)
    expect(Number(rows[0].cnt)).toBe(0)
  })

  it('authenticated role has NO SELECT on safety_alerts.created_by column', async () => {
    // Backend: column-grant — created_by excluded from GRANT SELECT (...)
    // Surface: supabase/migrations/20260619000500_safety_alert_created_by_column_grant.sql
    // Critical: reporter anonymity is the hard gate for this mission
    const rows = await queryProd(`
      SELECT has_column_privilege(
        'authenticated',
        'public.safety_alerts',
        'created_by',
        'SELECT'
      ) AS can_select
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].can_select, 'authenticated must NOT have SELECT on safety_alerts.created_by').toBe(false)
  })

  it('anon role has NO SELECT on safety_alerts.created_by column', async () => {
    // Backend: anon also blocked from created_by
    // Surface: unauthenticated viewer must not identify reporter
    const rows = await queryProd(`
      SELECT has_column_privilege(
        'anon',
        'public.safety_alerts',
        'created_by',
        'SELECT'
      ) AS can_select
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].can_select, 'anon must NOT have SELECT on safety_alerts.created_by').toBe(false)
  })

  it('safety alert RPCs are SECDEF', async () => {
    // Backend: place_safety_alert, vote_safety_alert, admin_verify_safety_alert, admin_remove_safety_alert
    // Surface: use-safety-alerts.ts:165 (place), :201 (vote), safety-alerts-review.tsx:93 (verify)
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN (
          'place_safety_alert',
          'vote_safety_alert',
          'safety_alerts_in_view',
          'admin_verify_safety_alert'
        )
    `)
    expect(rows.length).toBe(4)
    for (const row of rows) {
      expect(row.prosecdef, `${row.proname} must be SECDEF`).toBe(true)
    }
  })

  it('admin_verify_safety_alert has pinned search_path', async () => {
    // Backend: admin_verify_safety_alert — SECDEF + SET search_path
    // Surface: safety-alerts-review.tsx:93 → rpc('admin_verify_safety_alert')
    const rows = await queryProd(`
      SELECT proname, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND proname = 'admin_verify_safety_alert'
    `)
    expect(rows.length).toBeGreaterThan(0)
    const config = rows[0].proconfig as string[] | null
    const hasSearchPath = config?.some((c: string) => c.startsWith('search_path='))
    expect(hasSearchPath).toBe(true)
  })
})
