// 25-p2-0-integrity.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 25 — P2.0 integrity (Invariants I1 + I2, feed-fullfeed-p2-0-integrity)
// Surface: reviews / resource_opt_ins / conversations / event_checkins grants +
//          policies + triggers, SECDEF guest guards + EXECUTE, and the guest write
//          blocks (9 direct-write tables + mfa_backup_codes).
// Backend: supabase/migrations/20261004000000_p2_0_integrity.sql
//
// GATE ON THE LEDGER, NOT ON THE STATE. The migration is applied as a SEPARATE
// post-deploy step (GIT_PLAN feed-fullfeed-p2-0-integrity-postdeploy) and recorded in
// supabase_migrations.schema_migrations in the SAME step. The suite skips ONLY while
// that ledger row is absent (pre-deploy). Once recorded, the assertions ALWAYS run.
//
// NOTE ON SQL SAFETY: prod-client's WRITE_GUARD_RE rejects any statement with a SQL
// verb (insert/update/delete/alter/drop/truncate) at a line start or after ';'. This
// query is a single SELECT; every such word is a quoted string literal or column
// argument, and the inline comments deliberately avoid a verb after a newline or ';'.

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
    has_column_privilege('authenticated','public.resource_opt_ins','seeker_id','UPDATE') AS optins_seeker_upd,
    has_column_privilege('authenticated','public.resource_opt_ins','status','UPDATE')     AS optins_status_upd,
    has_table_privilege('authenticated','public.resource_opt_ins','UPDATE')               AS optins_tbl_upd,
    has_column_privilege('authenticated','public.conversations','volunteer_id','UPDATE')  AS conv_volunteer_upd,
    has_column_privilege('authenticated','public.conversations','status','UPDATE')         AS conv_status_upd,
    has_table_privilege('authenticated','public.conversations','UPDATE')                   AS conv_tbl_upd,
    -- reviews UPDATE: assert the policy expression EQUALS the exact admin-only text
    -- (both USING and WITH CHECK), so a trivially-true 'true OR ...' cannot pass.
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='reviews'
       AND policyname='reviews_update' AND cmd='UPDATE'
       AND qual = '( SELECT is_current_user_admin() AS is_current_user_admin)'
       AND with_check = '( SELECT is_current_user_admin() AS is_current_user_admin)')       AS reviews_upd_exact,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='reviews'
       AND cmd='INSERT')                                                                   AS reviews_insert_policies,
    -- resource_opt_ins: no PERMISSIVE direct INSERT policy (RPC path only); the
    -- RESTRICTIVE guest block does not count. DELETE is pending-only.
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='resource_opt_ins'
       AND cmd='INSERT' AND permissive='PERMISSIVE')                                       AS optins_insert_permissive,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='resource_opt_ins'
       AND cmd='DELETE' AND coalesce(qual,'') ILIKE '%pending%')                           AS optins_delete_pending,
    -- transition + force triggers present, ENABLED, and firing on the right events.
    -- tgtype bit 4 = INSERT, bit 16 = UPDATE; tgenabled 'D' = disabled.
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='conversations'
       AND t.tgname='trg_conversations_transition'
       AND (t.tgtype & 4) <> 0 AND (t.tgtype & 16) <> 0 AND t.tgenabled <> 'D')             AS conv_transition_trg,
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='resource_opt_ins'
       AND t.tgname='trg_resource_opt_ins_transition'
       AND (t.tgtype & 16) <> 0 AND t.tgenabled <> 'D')                                     AS optins_transition_trg,
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='event_checkins'
       AND t.tgname='trg_event_checkins_force_checked_in_by'
       AND (t.tgtype & 4) <> 0 AND (t.tgtype & 16) <> 0 AND t.tgenabled <> 'D')             AS checkins_force_trg,
    -- the check-in trigger function must stamp the caller (references auth.uid()).
    (SELECT (position('auth.uid()' IN pg_get_functiondef(p.oid)) > 0)
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='event_checkins_force_checked_in_by')         AS checkins_fn_uses_uid,
    -- I2: the 9 direct-write guest blocks — assert the EXACT shape (RESTRICTIVE,
    -- FOR INSERT, TO authenticated, WITH CHECK referencing the is_anonymous negation).
    (SELECT count(*) FROM pg_policies WHERE schemaname='public'
       AND permissive='RESTRICTIVE' AND cmd='INSERT' AND roles::text = '{authenticated}'
       AND coalesce(with_check,'') ILIKE '%is_anonymous%'
       AND coalesce(with_check,'') ILIKE '%not true%'
       AND policyname LIKE '%block_anon_insert'
       AND tablename IN ('poll_votes','event_checkins','favorites','saved_resources',
         'saved_resource_documents','saved_resource_events','saved_resource_tasks',
         'impact_metrics','petitions'))                                                    AS guest_blocks,
    -- I2: mfa_backup_codes — RESTRICTIVE guest blocks on all three write commands.
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='mfa_backup_codes'
       AND permissive='RESTRICTIVE' AND roles::text = '{authenticated}'
       AND cmd IN ('INSERT','UPDATE','DELETE')
       AND coalesce(qual,'') || coalesce(with_check,'') ILIKE '%is_anonymous%')            AS mfa_guest_blocks,
    -- I2: SECDEF writers carry the is_anonymous guard, EXECUTE only for authenticated.
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public'
       AND p.proname IN ('delete_safety_alert','update_safety_alert','withdraw_petition_signature')
       AND position('is_anonymous' IN pg_get_functiondef(p.oid)) > 0)                      AS secdef_guards,
    has_function_privilege('anon','public.delete_safety_alert(uuid)','EXECUTE')            AS anon_exec_del_alert,
    has_function_privilege('anon','public.withdraw_petition_signature(uuid)','EXECUTE')    AS anon_exec_withdraw_sig,
    has_function_privilege('authenticated','public.delete_safety_alert(uuid)','EXECUTE')  AS auth_exec_del_alert,
    has_function_privilege('authenticated','public.withdraw_petition_signature(uuid)','EXECUTE') AS auth_exec_withdraw_sig
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
    // reviews: UPDATE expression is EXACTLY the admin-only check; no client INSERT.
    expect(Number(r.reviews_upd_exact), 'reviews UPDATE must be exactly the admin-only expression').toBe(1)
    expect(Number(r.reviews_insert_policies), 'reviews must have no client INSERT policy').toBe(0)
    // resource_opt_ins: no PERMISSIVE INSERT (RPC-only); DELETE pending-only.
    expect(Number(r.optins_insert_permissive), 'opt_ins must have no permissive INSERT policy').toBe(0)
    expect(Number(r.optins_delete_pending), 'opt_ins DELETE must be pending-only').toBe(1)
    // transition + force triggers present, enabled, firing on the right events.
    expect(Number(r.conv_transition_trg), 'conversation transition trigger must fire on INSERT+UPDATE, enabled').toBe(1)
    expect(Number(r.optins_transition_trg), 'opt-in transition trigger must fire on UPDATE, enabled').toBe(1)
    expect(Number(r.checkins_force_trg), 'event_checkins force trigger must fire on INSERT+UPDATE, enabled').toBe(1)
    expect(r.checkins_fn_uses_uid, 'event_checkins force trigger function must reference auth.uid()').toBe(true)
  })

  it('[post-deploy] I2 — a guest can write no user-data row anywhere', async (ctx) => {
    const rows = await queryProd(GATE_AND_STATE_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    if (r.applied !== true) {
      ctx.skip()
      return
    }
    // Every direct-write gap carries the exact-shape RESTRICTIVE guest INSERT block.
    expect(Number(r.guest_blocks), 'all 9 guest INSERT blocks must be present with the exact shape').toBe(9)
    // mfa_backup_codes carries RESTRICTIVE guest blocks on INSERT/UPDATE/DELETE.
    expect(Number(r.mfa_guest_blocks), 'mfa_backup_codes must block guest INSERT/UPDATE/DELETE').toBe(3)
    // Every owner-scoped SECDEF writer carries the is_anonymous guard, EXECUTE authenticated-only.
    expect(Number(r.secdef_guards), 'all 3 SECDEF guest guards must be present').toBe(3)
    expect(r.anon_exec_del_alert, 'anon must NOT EXECUTE delete_safety_alert').toBe(false)
    expect(r.anon_exec_withdraw_sig, 'anon must NOT EXECUTE withdraw_petition_signature').toBe(false)
    expect(r.auth_exec_del_alert, 'authenticated must EXECUTE delete_safety_alert').toBe(true)
    expect(r.auth_exec_withdraw_sig, 'authenticated must EXECUTE withdraw_petition_signature').toBe(true)
  })
})
