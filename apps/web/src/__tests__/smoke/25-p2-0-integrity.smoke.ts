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
    -- Release 3: decide_opt_in is the audited path; the direct UPDATE (status) and the direct DELETE go with the
    -- contract step. Every Release 3 assertion is gated on its ledger row (r3_applied / r3_contract).
    EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261026600000') AS r3_applied,
    EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261026700000') AS r3_contract,
    has_table_privilege('authenticated','public.resource_opt_ins','DELETE')               AS optins_tbl_del,
    has_function_privilege('authenticated','public.withdraw_opt_in(uuid)','EXECUTE')       AS withdraw_rpc_exec,
    to_regprocedure('public.decide_opt_in(uuid,text,text)') IS NOT NULL                    AS decide_rpc,
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='resource_opt_ins' AND t.tgenabled <> 'D'
       AND t.tgname IN ('trg_resource_opt_ins_audit','trg_resource_opt_ins_return_slot'))  AS optins_r3_triggers,
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
    -- I2: SECDEF writers carry the guest guard, EXECUTE only for authenticated. SOURCE CHECK (a call would write):
    -- the body names the is_anonymous test, or (Release 3 alert writers) the shared gate whose behaviour is probed below.
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public'
       AND p.proname IN ('delete_safety_alert','update_safety_alert','withdraw_petition_signature')
       AND (position('is_anonymous' IN pg_get_functiondef(p.oid)) > 0
            OR position('public.safety_alert_require_member()' IN pg_get_functiondef(p.oid)) > 0)) AS secdef_guards,
    -- Release 3. SOURCE CHECK WITH A CONTROL (calling a writer from here would write to the database, so the call
    -- site is read from the source): each of the seven alert writers runs the shared gate as its FIRST act, in the
    -- initialiser of its first declared variable, before any statement. Control: the same matcher finds the gate in
    -- neither alert reader (they are open to guests and anon by design), so a count of 7 is not a blanket match.
    -- What the gate DOES for a guest and for a member is the behaviour probe in the third test below; what each
    -- writer answers a guest is asserted per writer in supabase/tests/r3_foundation.smoke.sql (A0, A1, A5, A8, A9, A10).
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public'
       AND p.proname IN ('place_safety_alert','update_safety_alert','resolve_safety_alert','delete_safety_alert',
                         'vote_safety_alert','admin_verify_safety_alert','admin_remove_safety_alert')
       AND p.prosrc ~ '^\\s*DECLARE\\s+v_uid uuid := public\\.safety_alert_require_member\\(\\);') AS alert_writers_gate_first_src,
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public'
       AND p.proname IN ('safety_alerts_in_view','safety_alert_history')
       AND p.prosrc ~ 'safety_alert_require_member')                                        AS alert_readers_gate_src_control,
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
    // Release 3: client-writable until the contract step (20261026700000), closed after it. From the foundation
    // step (20261026600000) decide_opt_in exists and every opt-in change is audited and slot-safe by trigger.
    expect(r.optins_status_upd, 'opt_ins.status is client-writable exactly until the Release 3 contract step').toBe(r.r3_contract !== true)
    if (r.r3_applied === true) {
      expect(r.decide_rpc, 'decide_opt_in (the audited author decision) must exist').toBe(true)
      expect(Number(r.optins_r3_triggers), 'the opt-in audit + slot-return triggers must be present and enabled').toBe(2)
    }
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
    // The pending-only DELETE policy and the DELETE grant stay until the Release 3 contract step, which removes
    // both (a seeker leaves through withdraw_opt_in, which stays executable).
    expect(Number(r.optins_delete_pending), 'opt_ins DELETE is pending-only until the Release 3 contract step, then gone').toBe(r.r3_contract === true ? 0 : 1)
    expect(r.optins_tbl_del, 'no client DELETE on opt_ins after the Release 3 contract step').toBe(r.r3_contract !== true)
    expect(r.withdraw_rpc_exec, 'withdraw_opt_in must stay executable by authenticated').toBe(true)
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
    if (r.r3_applied === true) {
      expect(Number(r.alert_writers_gate_first_src), 'all 7 alert writers must run the shared guest gate first (source check)').toBe(7)
      expect(Number(r.alert_readers_gate_src_control), 'control: the matcher must not find the gate in the two readers').toBe(0)
    }
    expect(r.anon_exec_del_alert, 'anon must NOT EXECUTE delete_safety_alert').toBe(false)
    expect(r.anon_exec_withdraw_sig, 'anon must NOT EXECUTE withdraw_petition_signature').toBe(false)
    expect(r.auth_exec_del_alert, 'authenticated must EXECUTE delete_safety_alert').toBe(true)
    expect(r.auth_exec_withdraw_sig, 'authenticated must EXECUTE withdraw_petition_signature').toBe(true)
  })

  // BEHAVIOUR (replaces the two text matches on the gate's body). safety_alert_require_member() is a STABLE
  // reader: it raises or returns the caller's id and writes nothing, so it is safe to call from here. Each probe is
  // ONE statement: the claims are set for that statement's transaction only (set_config(..., true)) in a
  // materialised CTE, then the gate is called once.
  const gateProbe = (claimsSql: string) => `
    WITH c AS MATERIALIZED (SELECT set_config('request.jwt.claims', ${claimsSql}, true) AS claims)
    SELECT public.safety_alert_require_member() IS NOT NULL AS passed FROM c WHERE c.claims IS NOT NULL
  `
  it('[post-deploy 20261026600000] the shared alert gate, called: refuses a guest by JWT claim and by the auth.users flag, refuses a caller with no account, passes a member', async (ctx) => {
    const gate = await queryProd(GATE_AND_STATE_SQL)
    if (gate[0]?.applied !== true || gate[0]?.r3_applied !== true) {
      ctx.skip()
      return
    }
    // control first: a member passes, so the refusals below are the gate's and not a broken probe
    const member = await queryProd(gateProbe(`(SELECT json_build_object('sub', id, 'role', 'authenticated', 'is_anonymous', false)::text
      FROM auth.users WHERE is_anonymous IS NOT TRUE ORDER BY created_at LIMIT 1)`))
    expect(member.length, 'the probe needs one member account').toBe(1)
    expect(member[0].passed, 'a member must pass the gate').toBe(true)
    // a guest by the JWT claim alone (no such account row)
    await expect(queryProd(gateProbe(`json_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'is_anonymous', true)::text`)))
      .rejects.toThrow(/Account required for this action/)
    // no account at all
    await expect(queryProd(gateProbe(`json_build_object('role', 'authenticated')::text`)))
      .rejects.toThrow(/not_authenticated/)
    // a guest by the auth.users flag alone: a token that does NOT carry the claim, for an account that is anonymous.
    // Provable only when such an account exists; where none does, the SQL smoke seeds one (principal G / GT).
    const guests = await queryProd(`SELECT count(*)::int AS n FROM auth.users WHERE is_anonymous IS TRUE`)
    if (Number(guests[0].n) > 0) {
      await expect(queryProd(gateProbe(`(SELECT json_build_object('sub', id, 'role', 'authenticated', 'is_anonymous', false)::text
        FROM auth.users WHERE is_anonymous IS TRUE ORDER BY created_at LIMIT 1)`)))
        .rejects.toThrow(/Account required for this action/)
    }
  })
})
