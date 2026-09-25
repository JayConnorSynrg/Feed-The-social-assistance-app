// 31-p3-1-admin-tiers.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 31 — P3.1 three admin tiers, nomination only (feed-fullfeed-p3-1-admin-tiers).
// Surface: admin_tier enum + column marker (T4), sync_tier_flags derivation trigger, founder
//          singleton, admin_actions append-only audit (T5), tier helpers + grant/revoke RPCs
//          hardening, the 6 RA resource fns re-gated, and the retired facilitator table.
// Backend: supabase/migrations/20261010000000_p3_1_admin_tiers.sql
//
// GATE ON THE LEDGER, NOT ON THE STATE. The migration is applied as a SEPARATE post-deploy step
// and recorded in supabase_migrations.schema_migrations in the SAME step. The suite skips ONLY
// while that ledger row is absent (pre-deploy). Once recorded, the assertions ALWAYS run.
//
// SQL SAFETY: prod-client's WRITE_GUARD_RE rejects any statement with a SQL verb
// (insert/update/delete/alter/drop/truncate) at a line start or after ';'. This file sends a
// single SELECT; every such word is a quoted string literal or column argument.

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

const STATE_SQL = `
  SELECT
    EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261010000000') AS applied,
    -- 1. enum has exactly 3 labels in order
    (SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)::text FROM pg_enum e
       JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='admin_tier')                         AS enum_labels,
    -- 2. profiles.admin_tier attacl: anon+authenticated SELECT, no write
    has_column_privilege('anon','public.profiles','admin_tier','SELECT')                          AS marker_anon_sel,
    has_column_privilege('authenticated','public.profiles','admin_tier','SELECT')                 AS marker_auth_sel,
    has_column_privilege('authenticated','public.profiles','admin_tier','UPDATE')                 AS marker_auth_upd,
    has_column_privilege('authenticated','public.profiles','admin_tier','INSERT')                 AS marker_auth_ins,
    -- 3. no drift: is_admin / is_staff derived from admin_tier
    (SELECT count(*) FROM public.profiles
       WHERE (admin_tier='platform_admin') <> is_admin OR (admin_tier IS NOT NULL) <> is_staff)   AS derivation_drift,
    -- 4. exactly 2 PA; founder singleton points at a PA
    (SELECT count(*) FROM public.profiles WHERE admin_tier='platform_admin')                       AS pa_count,
    (SELECT count(*) FROM public.platform_founder)                                                 AS founder_rows,
    (SELECT count(*) FROM public.platform_founder f JOIN public.profiles p ON p.id=f.user_id
       WHERE p.admin_tier='platform_admin')                                                        AS founder_is_pa,
    -- 5. old trigger gone, new trigger present
    (SELECT count(*) FROM pg_trigger WHERE tgname='sync_is_staff_trigger')                         AS old_trigger,
    (SELECT count(*) FROM pg_trigger WHERE tgname='sync_tier_flags_trigger')                       AS new_trigger,
    -- 6. admin_actions: no anon; authenticated SELECT only; service_role lacks write
    has_table_privilege('anon','public.admin_actions','SELECT')                                    AS aa_anon_sel,
    has_table_privilege('authenticated','public.admin_actions','SELECT')                           AS aa_auth_sel,
    has_table_privilege('authenticated','public.admin_actions','INSERT')                           AS aa_auth_ins,
    has_table_privilege('service_role','public.admin_actions','SELECT')                            AS aa_svc_sel,
    has_table_privilege('service_role','public.admin_actions','INSERT')                            AS aa_svc_ins,
    has_table_privilege('service_role','public.admin_actions','UPDATE')                            AS aa_svc_upd,
    has_table_privilege('service_role','public.admin_actions','DELETE')                            AS aa_svc_del,
    -- 7. hardening: pinned search_path + no anon EXECUTE; writers no authenticated EXECUTE
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public'
         AND p.proname IN ('current_user_tier','current_user_tier_at_least','tier_of','is_founder',
                           'request_id','admin_set_tier','service_set_tier','admin_list_people','record_admin_action','sync_tier_flags')
         AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c WHERE c LIKE 'search_path=%')) AS fns_missing_searchpath,
    has_function_privilege('anon','public.admin_set_tier(uuid,public.admin_tier,text,text)','EXECUTE')      AS anon_can_set_tier,
    has_function_privilege('anon','public.current_user_tier()','EXECUTE')                                   AS anon_can_tier,
    has_function_privilege('authenticated','public.service_set_tier(uuid,public.admin_tier,text)','EXECUTE') AS auth_can_service_set,
    has_function_privilege('authenticated','public.record_admin_action(uuid,text,text,text,text,text,jsonb,text)','EXECUTE') AS auth_can_record,
    has_function_privilege('authenticated','public.admin_set_tier(uuid,public.admin_tier,text,text)','EXECUTE') AS auth_can_set_tier,
    has_function_privilege('authenticated','public.admin_list_people(text,integer)','EXECUTE')             AS auth_can_list_people,
    -- 8. the 6 RA resource fns carry the RA gate and no longer reference is_current_user_admin
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public'
         AND p.proname IN ('admin_list_pending_resources','admin_list_resources','approve_resource',
                           'reject_resource','admin_update_resource','set_resource_location_by_id')
         AND p.prosrc LIKE '%current_user_tier_at_least(''resource_admin'')%')                     AS ra_fns_gated,
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public'
         AND p.proname IN ('admin_list_pending_resources','admin_list_resources','approve_resource',
                           'reject_resource','admin_update_resource','set_resource_location_by_id')
         AND p.prosrc LIKE '%is_current_user_admin%')                                              AS ra_fns_still_icua,
    -- the 6 CM RPCs carry the CM gate (semantically = is_staff) and write an audit row
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public'
         AND p.proname IN ('admin_remove_post','admin_hold_post','admin_authorize_post',
                           'admin_resolve_report','admin_verify_safety_alert','admin_remove_safety_alert')
         AND p.prosrc LIKE '%current_user_tier_at_least(''community_moderator'')%'
         AND p.prosrc LIKE '%record_admin_action%')                                                AS cm_fns_gated_audited,
    -- 9/10. facilitator retired
    (to_regclass('public.admin_code_redemptions') IS NULL)                                          AS facilitator_table_gone,
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND (p.prosrc ILIKE '%admin_code%' OR p.proname ILIKE '%facilitator%')) AS admin_code_proc_refs
`

type Row = Record<string, unknown>

maybeDescribe('P3.1 — three admin tiers (prod, read-only)', () => {
  let row: Row
  let applied = false

  it('loads state', async () => {
    const rows = await queryProd(STATE_SQL)
    row = rows[0]
    applied = row.applied === true
    expect(row).toBeTruthy()
  })

  const gated = (name: string, fn: (r: Row) => void) =>
    it(name, () => {
      if (!applied) return // pre-deploy: ledger row absent, assertions skipped
      fn(row)
    })

  gated('1. admin_tier enum has 3 labels in order', (r) => {
    expect(r.enum_labels).toBe('{community_moderator,resource_admin,platform_admin}')
  })
  gated('2. admin_tier marker is public-read, no client write (T4)', (r) => {
    expect(r.marker_anon_sel).toBe(true)
    expect(r.marker_auth_sel).toBe(true)
    expect(r.marker_auth_upd).toBe(false)
    expect(r.marker_auth_ins).toBe(false)
  })
  gated('3. is_admin/is_staff derived from admin_tier (no drift)', (r) => {
    expect(Number(r.derivation_drift)).toBe(0)
  })
  gated('4. exactly 2 PA; founder singleton is a PA', (r) => {
    expect(Number(r.pa_count)).toBe(2)
    expect(Number(r.founder_rows)).toBe(1)
    expect(Number(r.founder_is_pa)).toBe(1)
  })
  gated('5. sync_is_staff_trigger replaced by sync_tier_flags_trigger', (r) => {
    expect(Number(r.old_trigger)).toBe(0)
    expect(Number(r.new_trigger)).toBe(1)
  })
  gated('6. admin_actions append-only, PA-read only (T5)', (r) => {
    expect(r.aa_anon_sel).toBe(false)
    expect(r.aa_auth_sel).toBe(true)
    expect(r.aa_auth_ins).toBe(false)
    expect(r.aa_svc_sel).toBe(true)
    expect(r.aa_svc_ins).toBe(false)
    expect(r.aa_svc_upd).toBe(false)
    expect(r.aa_svc_del).toBe(false)
  })
  gated('7. new SECDEF fns hardened; writers not client-callable', (r) => {
    expect(Number(r.fns_missing_searchpath)).toBe(0)
    expect(r.anon_can_set_tier).toBe(false)
    expect(r.anon_can_tier).toBe(false)
    expect(r.auth_can_service_set).toBe(false)
    expect(r.auth_can_record).toBe(false)
    expect(r.auth_can_set_tier).toBe(true)
    expect(r.auth_can_list_people).toBe(true)
  })
  gated('8. RA fns re-gated; CM fns gated + audited', (r) => {
    expect(Number(r.ra_fns_gated)).toBe(6)
    expect(Number(r.ra_fns_still_icua)).toBe(0)
    expect(Number(r.cm_fns_gated_audited)).toBe(6)
  })
  gated('9/10. facilitator code retired', (r) => {
    expect(r.facilitator_table_gone).toBe(true)
    expect(Number(r.admin_code_proc_refs)).toBe(0)
  })
})
