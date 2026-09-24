// 28-w1-6a-events-checkin.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 28 — W1.6a event hosting + two-state check-in + attendance
//          (feed-fullfeed-w1-6a-events-hosting)
// Surface: event_checkins status/confirmed columns + write lockdown (RPC-only),
//          the check_in / organizer_confirm / event_attendance / my_attendance_rate /
//          admin_create_event / admin_update_event SECDEF RPCs (pinned search_path +
//          authenticated-only EXECUTE), the confirmation-time credit trigger, the
//          reconcile lockdown regression, and assistance_events geocode tagging.
// Backend: supabase/migrations/20261007000000_w1_6a_events_hosting_checkin.sql
//
// GATE ON THE LEDGER, NOT ON THE STATE. The migration applies as a SEPARATE post-deploy
// step recorded in supabase_migrations.schema_migrations. The suite skips ONLY while that
// ledger row is absent (pre-deploy). Once recorded, the assertions ALWAYS run.
//
// EMPIRICAL NOTE: every predicate below was validated against prod inside a single
// BEGIN; … (RAISE→ROLLBACK) transaction on 2026-09-24 (the migration applied cleanly on
// PG 17.6 and 32 behavioural checks passed — two-state check-in, organizer confirm,
// attendance math + no-show derivation, org-scoped rates, guest/direct-write rejection,
// credit-once-at-confirm, reconcile parity, account deletion) — these mirror those results.
//
// SQL SAFETY: single SELECT; every mutating word is a quoted literal / column argument.
// No SQL verb appears at a line start or after ';' (prod-client WRITE_GUARD_RE).

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

const GATE_SQL = `
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261007000000'
  ) AS applied
`

const STATE_SQL = `
  SELECT
    -- Schema: new two-state columns on event_checkins + geocode tags on assistance_events.
    (SELECT count(*) FROM information_schema.columns
       WHERE table_schema='public' AND table_name='event_checkins'
       AND column_name IN ('status','confirmed_at','confirmed_by'))                       AS checkin_cols,
    (SELECT count(*) FROM information_schema.columns
       WHERE table_schema='public' AND table_name='assistance_events'
       AND column_name IN ('geocode_accuracy','geocode_confidence'))                      AS event_geo_cols,
    -- status CHECK allows exactly early/confirmed.
    (SELECT count(*) FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid
       WHERE cl.relname='event_checkins' AND c.contype='c'
       AND pg_get_constraintdef(c.oid) ILIKE '%early%' AND pg_get_constraintdef(c.oid) ILIKE '%confirmed%') AS status_check,
    -- I1: NO client write privilege on event_checkins (table level), SELECT retained.
    has_table_privilege('authenticated','public.event_checkins','INSERT')                 AS auth_insert,
    has_table_privilege('authenticated','public.event_checkins','UPDATE')                 AS auth_update,
    has_table_privilege('authenticated','public.event_checkins','DELETE')                 AS auth_delete,
    has_table_privilege('authenticated','public.event_checkins','SELECT')                 AS auth_select,
    has_table_privilege('anon','public.event_checkins','INSERT')                          AS anon_insert,
    -- The permissive client write policies are gone; SELECT-own + the RESTRICTIVE guest
    -- block remain.
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='event_checkins'
       AND cmd IN ('INSERT','UPDATE') AND permissive='PERMISSIVE')                        AS checkin_write_policies,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='event_checkins'
       AND cmd='SELECT' AND coalesce(qual,'') ILIKE '%auth.uid()%')                       AS checkin_select_own,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='event_checkins'
       AND permissive='RESTRICTIVE' AND policyname='event_checkins_block_anon_insert')    AS checkin_guest_block,
    -- The 7 W1.6a functions are SECDEF with a pinned search_path.
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public'
       AND p.proname IN ('check_in','organizer_confirm','event_attendance','my_attendance_rate',
         'admin_create_event','admin_update_event','w1_6a_user_org_rate')
       AND p.prosecdef AND array_to_string(p.proconfig,',') ILIKE '%search_path%')        AS secdef_pinned,
    -- Client-callable RPCs: authenticated EXECUTE, anon denied.
    has_function_privilege('authenticated','public.check_in(uuid,integer,boolean)','EXECUTE')            AS checkin_auth_exec,
    has_function_privilege('anon','public.check_in(uuid,integer,boolean)','EXECUTE')                     AS checkin_anon_exec,
    has_function_privilege('authenticated','public.organizer_confirm(uuid,uuid,integer)','EXECUTE')      AS orgconf_auth_exec,
    has_function_privilege('anon','public.organizer_confirm(uuid,uuid,integer)','EXECUTE')               AS orgconf_anon_exec,
    has_function_privilege('authenticated','public.event_attendance(uuid)','EXECUTE')                    AS att_auth_exec,
    has_function_privilege('authenticated','public.my_attendance_rate()','EXECUTE')                      AS myrate_auth_exec,
    has_function_privilege('anon','public.my_attendance_rate()','EXECUTE')                               AS myrate_anon_exec,
    has_function_privilege('authenticated','public.admin_create_event(uuid,text,text,text,text,text,text,text,text,text,integer,boolean,double precision,double precision,text,text)','EXECUTE') AS create_auth_exec,
    has_function_privilege('anon','public.admin_create_event(uuid,text,text,text,text,text,text,text,text,text,integer,boolean,double precision,double precision,text,text)','EXECUTE')          AS create_anon_exec,
    -- The org-scoped rate helper is internal only (never client-executable).
    has_function_privilege('authenticated','public.w1_6a_user_org_rate(uuid,uuid)','EXECUTE')            AS rate_helper_auth_exec,
    -- Credit trigger: present, ENABLED, AFTER + ROW, fires on INSERT and UPDATE, confirmed-only body.
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='event_checkins' AND t.tgname='trg_engagement_event_checkin'
       AND (t.tgtype & 1)<>0 AND (t.tgtype & 2)=0 AND (t.tgtype & 4)<>0 AND (t.tgtype & 16)<>0 AND t.tgenabled<>'D') AS credit_trigger,
    (SELECT (pg_get_functiondef(p.oid) ILIKE '%status = ''confirmed''%')
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='engagement_on_event_checkin')             AS credit_confirmed_only,
    -- Regression: reconcile stays non-client-executable; P2.1a/b classifier undisturbed.
    has_function_privilege('authenticated','public.reconcile_engagement(uuid)','EXECUTE') AS reconcile_auth_exec,
    public.engagement_is_public('like')                                                  AS like_public,
    public.engagement_is_public('appreciation_gift')                                     AS appr_public,
    -- Finding #6: assistance_events location/address is RPC-only — no client table writes,
    -- no client write policy; SELECT retained.
    has_table_privilege('authenticated','public.assistance_events','INSERT')              AS ae_auth_insert,
    has_table_privilege('authenticated','public.assistance_events','UPDATE')              AS ae_auth_update,
    has_table_privilege('authenticated','public.assistance_events','DELETE')              AS ae_auth_delete,
    has_table_privilege('authenticated','public.assistance_events','SELECT')              AS ae_auth_select,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='assistance_events'
       AND cmd IN ('INSERT','UPDATE','DELETE'))                                           AS ae_write_policies,
    has_function_privilege('authenticated','public.w1_6a_validate_geo(double precision,double precision,text)','EXECUTE') AS validate_geo_auth_exec,
    -- Finding #7/#2: the private anonymous-claims ledger is RLS-on and unreadable/unwritable
    -- by any client (no policies, all privileges revoked).
    (SELECT relrowsecurity FROM pg_class WHERE oid='public.event_anonymous_claims'::regclass) AS claims_rls,
    has_table_privilege('authenticated','public.event_anonymous_claims','SELECT')         AS claims_auth_select,
    has_table_privilege('authenticated','public.event_anonymous_claims','INSERT')         AS claims_auth_insert,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='event_anonymous_claims') AS claims_policies,
    -- Finding #3: org membership WRITES are platform-admin-only (no org-admin write policy).
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='organization_members'
       AND cmd IN ('INSERT','UPDATE','DELETE')
       AND coalesce(with_check,coalesce(qual,'')) ILIKE '%is_current_user_admin%'
       AND coalesce(with_check,coalesce(qual,'')) NOT ILIKE '%is_org_admin%')             AS orgmem_platform_only,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='organization_members'
       AND cmd IN ('INSERT','UPDATE','DELETE')
       AND coalesce(with_check,coalesce(qual,'')) ILIKE '%is_org_admin%')                 AS orgmem_orgadmin_write,
    -- Finding #4: the org-admin reachability gate is client-callable (authenticated), anon denied.
    has_function_privilege('authenticated','public.is_org_admin_any()','EXECUTE')         AS orgadminany_auth_exec,
    has_function_privilege('anon','public.is_org_admin_any()','EXECUTE')                  AS orgadminany_anon_exec,
    -- ── Fix-round 2 (H1/M2/M3 + retire + attendance marker) ──
    -- is_anonymous marker column (NOT NULL, default false) — the authoritative anonymous flag.
    (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
       AND table_name='event_checkins' AND column_name='is_anonymous' AND is_nullable='NO')  AS checkin_is_anon_col,
    -- attendance counts anonymous by the marker, not by user_id IS NULL.
    (SELECT pg_get_functiondef(p.oid) ILIKE '%is_anonymous%' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='event_attendance')                            AS att_uses_is_anon_marker,
    -- M2: my_anonymous_claims is SECDEF + pinned, authenticated-only.
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
       AND p.proname='my_anonymous_claims' AND p.prosecdef AND array_to_string(p.proconfig,',') ILIKE '%search_path%') AS myclaims_secdef_pinned,
    has_function_privilege('authenticated','public.my_anonymous_claims(uuid[])','EXECUTE')    AS myclaims_auth_exec,
    has_function_privilege('anon','public.my_anonymous_claims(uuid[])','EXECUTE')             AS myclaims_anon_exec,
    -- H1: platform admins can read any org's roster (roster read + DELETE/UPDATE...RETURNING).
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='organization_members'
       AND cmd='SELECT' AND policyname='org_members_select_platform_admin')                   AS orgmem_select_platform,
    -- M3: the occurrence check-in-bounds guard trigger is present, BEFORE UPDATE, enabled.
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='event_occurrences'
       AND t.tgname='trg_event_occurrences_guard_checkin_bounds'
       AND (t.tgtype & 2)<>0 AND (t.tgtype & 16)<>0 AND t.tgenabled<>'D')                     AS m3_guard_trigger,
    -- Retirement + explicit-clear: admin_update_event now carries p_is_active + p_clear (19 args).
    has_function_privilege('authenticated','public.admin_update_event(uuid,text,text,text,text,text,text,text,text,text,integer,boolean,double precision,double precision,text,text,boolean,boolean,text[])','EXECUTE') AS update_event_retire_exec
`

maybeDescribe('28 — W1.6a events + two-state check-in (PROD read-only)', () => {
  it('[post-deploy] I1/I5 — schema, RPC-only writes, SECDEF lockdown', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }
    const rows = await queryProd(STATE_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    expect(Number(r.checkin_cols), 'event_checkins must have status/confirmed_at/confirmed_by').toBe(3)
    expect(Number(r.event_geo_cols), 'assistance_events must have geocode_accuracy/geocode_confidence').toBe(2)
    expect(Number(r.status_check), 'status CHECK must allow early/confirmed').toBe(1)
    // I1: no client writes; SELECT kept; guest block kept; permissive write policies gone.
    expect(r.auth_insert, 'authenticated must NOT INSERT event_checkins').toBe(false)
    expect(r.auth_update, 'authenticated must NOT UPDATE event_checkins').toBe(false)
    expect(r.auth_delete, 'authenticated must NOT DELETE event_checkins').toBe(false)
    expect(r.auth_select, 'authenticated may SELECT (RLS-scoped)').toBe(true)
    expect(r.anon_insert, 'anon must NOT INSERT event_checkins').toBe(false)
    expect(Number(r.checkin_write_policies), 'no permissive client INSERT/UPDATE policy remains').toBe(0)
    expect(Number(r.checkin_select_own), 'own-read SELECT policy must remain').toBeGreaterThanOrEqual(1)
    expect(Number(r.checkin_guest_block), 'the RESTRICTIVE guest INSERT block must remain').toBe(1)
    // SECDEF + pinned search_path across all 7 new functions.
    expect(Number(r.secdef_pinned), 'all 7 W1.6a functions must be SECDEF with a pinned search_path').toBe(7)
  })

  it('[post-deploy] I3/I4/R6 — EXECUTE grants, credit-at-confirm, regressions', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }
    const rows = await queryProd(STATE_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    // Client-callable RPCs: authenticated yes, anon no.
    expect(r.checkin_auth_exec, 'authenticated must EXECUTE check_in').toBe(true)
    expect(r.checkin_anon_exec, 'anon must NOT EXECUTE check_in').toBe(false)
    expect(r.orgconf_auth_exec, 'authenticated must EXECUTE organizer_confirm').toBe(true)
    expect(r.orgconf_anon_exec, 'anon must NOT EXECUTE organizer_confirm').toBe(false)
    expect(r.att_auth_exec, 'authenticated must EXECUTE event_attendance').toBe(true)
    expect(r.myrate_auth_exec, 'authenticated must EXECUTE my_attendance_rate').toBe(true)
    expect(r.myrate_anon_exec, 'anon must NOT EXECUTE my_attendance_rate').toBe(false)
    expect(r.create_auth_exec, 'authenticated must EXECUTE admin_create_event').toBe(true)
    expect(r.create_anon_exec, 'anon must NOT EXECUTE admin_create_event').toBe(false)
    // I4: the org-scoped rate helper is internal only.
    expect(r.rate_helper_auth_exec, 'w1_6a_user_org_rate must NOT be client-executable').toBe(false)
    // R6: credit trigger fires on INSERT+UPDATE (AFTER+ROW), confirmed-only.
    expect(Number(r.credit_trigger), 'trg_engagement_event_checkin must fire AFTER INSERT+UPDATE, enabled').toBe(1)
    expect(r.credit_confirmed_only, 'the credit trigger body must gate on status = confirmed').toBe(true)
    // Regression: reconcile locked; classifier undisturbed.
    expect(r.reconcile_auth_exec, 'reconcile_engagement must stay non-client-executable').toBe(false)
    expect(r.like_public, 'like must remain public').toBe(true)
    expect(r.appr_public, 'appreciation_gift must remain public').toBe(true)
  })

  it('[post-deploy] fix-round — event writes RPC-only, private anon claims, membership + gate', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }
    const rows = await queryProd(STATE_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    // Finding #6: assistance_events location/address is RPC-only.
    expect(r.ae_auth_insert, 'authenticated must NOT INSERT assistance_events directly').toBe(false)
    expect(r.ae_auth_update, 'authenticated must NOT UPDATE assistance_events directly').toBe(false)
    expect(r.ae_auth_delete, 'authenticated must NOT DELETE assistance_events directly').toBe(false)
    expect(r.ae_auth_select, 'authenticated may still SELECT assistance_events').toBe(true)
    expect(Number(r.ae_write_policies), 'no client write policy remains on assistance_events').toBe(0)
    expect(r.validate_geo_auth_exec, 'w1_6a_validate_geo must NOT be client-executable').toBe(false)
    // Finding #7/#2: the anonymous-claims ledger is private to the server.
    expect(r.claims_rls, 'event_anonymous_claims must have RLS enabled').toBe(true)
    expect(r.claims_auth_select, 'authenticated must NOT read event_anonymous_claims').toBe(false)
    expect(r.claims_auth_insert, 'authenticated must NOT write event_anonymous_claims').toBe(false)
    expect(Number(r.claims_policies), 'event_anonymous_claims must have no client policy').toBe(0)
    // Finding #3: org membership writes are platform-admin-only.
    expect(Number(r.orgmem_platform_only), 'all 3 org-member write policies must be platform-admin-only').toBe(3)
    expect(Number(r.orgmem_orgadmin_write), 'no org-member write policy may grant org admins').toBe(0)
    // Finding #4: org-admin reachability gate is authenticated-callable, anon denied.
    expect(r.orgadminany_auth_exec, 'authenticated must EXECUTE is_org_admin_any').toBe(true)
    expect(r.orgadminany_anon_exec, 'anon must NOT EXECUTE is_org_admin_any').toBe(false)
  })

  it('[post-deploy] fix-round 2 — H1 roster, M2 anon-claims, M3 bounds guard, retire', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }
    const r = (await queryProd(STATE_SQL))[0]
    // is_anonymous marker column + attendance uses it (not user_id IS NULL).
    expect(Number(r.checkin_is_anon_col), 'event_checkins must have a NOT NULL is_anonymous column').toBe(1)
    expect(r.att_uses_is_anon_marker, 'event_attendance must count anonymous by the is_anonymous marker').toBe(true)
    // M2: my_anonymous_claims — SECDEF + pinned, authenticated-only.
    expect(Number(r.myclaims_secdef_pinned), 'my_anonymous_claims must be SECDEF with a pinned search_path').toBe(1)
    expect(r.myclaims_auth_exec, 'authenticated must EXECUTE my_anonymous_claims').toBe(true)
    expect(r.myclaims_anon_exec, 'anon must NOT EXECUTE my_anonymous_claims').toBe(false)
    // H1: platform-admin roster SELECT policy present.
    expect(Number(r.orgmem_select_platform), 'platform-admin roster SELECT policy must exist').toBe(1)
    // M3: occurrence check-in-bounds guard trigger present (BEFORE UPDATE, enabled).
    expect(Number(r.m3_guard_trigger), 'the M3 occurrence-bounds guard trigger must be present + enabled').toBe(1)
    // Retirement + explicit clear.
    expect(r.update_event_retire_exec, 'admin_update_event must expose p_is_active + p_clear (retire/clear)').toBe(true)
  })
})
