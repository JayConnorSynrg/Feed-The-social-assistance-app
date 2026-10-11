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

  it('all nine safety alert RPCs are SECDEF with search_path = public, pg_temp, one signature each', async () => {
    // Backend: 20261026600000 — place / update / resolve / delete (withdraw) / vote / admin_verify / admin_remove,
    // and the two readers safety_alerts_in_view + safety_alert_history.
    // Surface: use-safety-alerts.ts (place, vote, update, delete, read), safety-alerts-review.tsx (verify, remove)
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN (
          'place_safety_alert', 'update_safety_alert', 'resolve_safety_alert', 'delete_safety_alert',
          'vote_safety_alert', 'admin_verify_safety_alert', 'admin_remove_safety_alert',
          'safety_alerts_in_view', 'safety_alert_history'
        )
    `)
    expect(rows.length).toBe(9)
    for (const row of rows) {
      expect(row.prosecdef, `${row.proname} must be SECDEF`).toBe(true)
      expect(row.proconfig, `${row.proname} must pin search_path = public, pg_temp`).toEqual(['search_path=public, pg_temp'])
    }
  })

  it('no client role can SELECT safety_alerts.verified_by (the verifying moderator stays anonymous too)', async () => {
    const rows = await queryProd(`
      SELECT has_column_privilege('anon', 'public.safety_alerts', 'verified_by', 'SELECT')          AS anon_sel,
             has_column_privilege('authenticated', 'public.safety_alerts', 'verified_by', 'SELECT') AS auth_sel
    `)
    expect(rows[0].anon_sel, 'anon must NOT have SELECT on safety_alerts.verified_by').toBe(false)
    expect(rows[0].auth_sel, 'authenticated must NOT have SELECT on safety_alerts.verified_by').toBe(false)
  })

  it('no alert RPC returns the safety_alerts row or an identity column; clients hold no write bit and no grant on the history', async () => {
    const rows = await queryProd(`
      SELECT
        (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname ~ 'safety_alert' AND p.prorettype <> 'trigger'::regtype
            AND pg_get_function_result(p.oid) ~ '(created_by|verified_by|actor_id|safety_alerts$)')         AS identity_returners,
        (SELECT count(*)::int FROM unnest(ARRAY['anon','authenticated']) r,
                unnest(ARRAY['public.safety_alerts','public.safety_alert_votes','public.safety_alert_updates']) t,
                unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE']) pr WHERE has_table_privilege(r, t, pr)) AS client_write_bits,
        has_table_privilege('authenticated', 'public.safety_alert_updates', 'SELECT')                       AS history_select,
        (SELECT count(*)::int FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND tablename IN ('safety_alert_votes', 'safety_alert_updates')) AS published
    `)
    expect(rows[0].identity_returners).toBe(0)
    expect(rows[0].client_write_bits).toBe(0)
    expect(rows[0].history_select).toBe(false)
    expect(rows[0].published).toBe(0)
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
    expect(rows.length, 'exactly one admin_verify_safety_alert signature (no PostgREST overload)').toBe(1)
    const config = rows[0].proconfig as string[] | null
    expect(config).toEqual(['search_path=public, pg_temp'])
  })
})
