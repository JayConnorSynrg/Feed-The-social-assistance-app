// 25-p2-0-integrity.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 25 — P2.0 integrity (Invariants I1 + I2, feed-fullfeed-p2-0-integrity)
// Surface: reviews / resource_opt_ins / conversations / event_checkins grants +
//          policies + triggers, SECDEF guest guards, and the 9 guest INSERT blocks.
// Backend: supabase/migrations/20261004000000_p2_0_integrity.sql
//
// GATE ON THE LEDGER, NOT ON THE STATE. The migration is applied as a SEPARATE
// post-deploy step (GIT_PLAN feed-fullfeed-p2-0-integrity-postdeploy) and recorded in
// supabase_migrations.schema_migrations in the SAME step. The suite skips ONLY while
// that ledger row is absent (pre-deploy). Once recorded, the assertions ALWAYS run —
// so a later regression (a re-grant of a locked column, a dropped guest block, a guard
// removed) FAILS the suite instead of silently skipping.
//
// Every privilege/keyword below is a quoted argument or string literal (never a leading
// SQL verb), so this passes prod-client's WRITE_GUARD_RE.

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

const GATE_AND_STATE_SQL = `
  SELECT
    EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE version = '20261004000000'
    )                                                                                    AS applied,
    -- I1: resource_opt_ins column-lock (seeker_id locked, status writable, table revoked)
    has_column_privilege('authenticated','public.resource_opt_ins','seeker_id','UPDATE') AS optins_seeker_upd,
    has_column_privilege('authenticated','public.resource_opt_ins','status','UPDATE')     AS optins_status_upd,
    has_table_privilege('authenticated','public.resource_opt_ins','UPDATE')               AS optins_tbl_upd,
    -- I1: conversations column-lock (participant locked, status writable, table revoked)
    has_column_privilege('authenticated','public.conversations','volunteer_id','UPDATE')  AS conv_volunteer_upd,
    has_column_privilege('authenticated','public.conversations','status','UPDATE')         AS conv_status_upd,
    has_table_privilege('authenticated','public.conversations','UPDATE')                   AS conv_tbl_upd,
    -- I1: reviews UPDATE is admin-only (no reviewer_id in the qual) and no client INSERT policy
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='reviews'
       AND cmd='UPDATE' AND coalesce(qual,'') ILIKE '%reviewer_id%')                       AS reviews_upd_reviewer,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='reviews'
       AND cmd='INSERT')                                                                   AS reviews_insert_policies,
    -- I1: resource_opt_ins no direct INSERT policy (RPC-only); DELETE is pending-only
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='resource_opt_ins'
       AND cmd='INSERT')                                                                   AS optins_insert_policies,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='resource_opt_ins'
       AND cmd='DELETE' AND coalesce(qual,'') ILIKE '%pending%')                           AS optins_delete_pending,
    -- I1: transition + force triggers present
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='conversations'
       AND t.tgname='trg_conversations_transition')                                        AS conv_transition_trg,
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='event_checkins'
       AND t.tgname='trg_event_checkins_force_checked_in_by')                              AS checkins_force_trg,
    -- I2: 9 guest RESTRICTIVE INSERT blocks present
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND permissive='RESTRICTIVE'
       AND policyname LIKE '%block_anon_insert' AND cmd='INSERT'
       AND tablename IN ('poll_votes','event_checkins','favorites','saved_resources',
         'saved_resource_documents','saved_resource_events','saved_resource_tasks',
         'impact_metrics','petitions'))                                                    AS guest_blocks,
    -- I2: 3 SECDEF writers carry the is_anonymous guard
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public'
       AND p.proname IN ('delete_safety_alert','update_safety_alert','withdraw_petition_signature')
       AND position('is_anonymous' IN pg_get_functiondef(p.oid)) > 0)                      AS secdef_guards
`

maybeDescribe('25 — P2.0 integrity (PROD read-only)', () => {
  it('[post-deploy] I1 — state-bearing columns changeable only via the entitled path', async (ctx) => {
    const rows = await queryProd(GATE_AND_STATE_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    if (r.applied !== true) {
      ctx.skip()
      return
    }
    // resource_opt_ins: only `status` is client-writable; seeker_id/table locked.
    expect(r.optins_seeker_upd, 'opt_ins.seeker_id must NOT be client-writable').toBe(false)
    expect(r.optins_status_upd, 'opt_ins.status must remain client-writable (author flow)').toBe(true)
    expect(r.optins_tbl_upd, 'opt_ins table-level UPDATE must be revoked').toBe(false)
    // conversations: only `status` is client-writable; participants/table locked.
    expect(r.conv_volunteer_upd, 'conversations.volunteer_id must NOT be client-writable').toBe(false)
    expect(r.conv_status_upd, 'conversations.status must remain client-writable').toBe(true)
    expect(r.conv_tbl_upd, 'conversations table-level UPDATE must be revoked').toBe(false)
    // reviews: UPDATE admin-only (reviewee_id/rating forge closed); no client INSERT path.
    expect(Number(r.reviews_upd_reviewer), 'reviews UPDATE must not admit the reviewer').toBe(0)
    expect(Number(r.reviews_insert_policies), 'reviews must have no client INSERT policy').toBe(0)
    // resource_opt_ins: RPC-only INSERT; DELETE pending-only.
    expect(Number(r.optins_insert_policies), 'opt_ins must have no direct INSERT policy').toBe(0)
    expect(Number(r.optins_delete_pending), 'opt_ins DELETE must be pending-only').toBe(1)
    // transition + force triggers present.
    expect(Number(r.conv_transition_trg), 'conversation transition trigger must exist').toBe(1)
    expect(Number(r.checkins_force_trg), 'event_checkins force-checked_in_by trigger must exist').toBe(1)
  })

  it('[post-deploy] I2 — a guest can write no user-data row anywhere', async (ctx) => {
    const rows = await queryProd(GATE_AND_STATE_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    if (r.applied !== true) {
      ctx.skip()
      return
    }
    // Every direct-write gap now carries a RESTRICTIVE guest INSERT block.
    expect(Number(r.guest_blocks), 'all 9 guest INSERT blocks must be present').toBe(9)
    // Every owner-scoped SECDEF writer now carries the is_anonymous guard.
    expect(Number(r.secdef_guards), 'all 3 SECDEF guest guards must be present').toBe(3)
  })
})
