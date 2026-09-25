// 30-p3-0-moderation-guards.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 30 — P3.0 moderation-authority guards + volunteer withdraw
//          (feed-fullfeed-p3-0-moderation-guards)
// Surface: three BEFORE INSERT/UPDATE guard triggers (SECURITY INVOKER) that stop client
//          roles from forging moderation authority —
//            I1  resources.status / moderated_by / moderated_at / is_verified / last_verified_at
//            I6  post_comments.is_hidden
//            I3  organizations.is_active / created_by / id / created_at (org admins, active only)
//          plus the I1b RLS policy that lets a volunteer withdraw (archive) their own listing,
//          and the drop of the duplicate updated_at trigger on post_comments.
// Backend: supabase/migrations/20261009000000_p3_0_moderation_guards.sql
//
// GATE ON THE LEDGER, NOT ON THE STATE. The migration applies as a SEPARATE post-deploy step
// recorded in supabase_migrations.schema_migrations. The suite skips ONLY while that ledger
// row is absent (pre-deploy). Once recorded, the assertions ALWAYS run.
//
// EMPIRICAL NOTE: every guard was proven against prod on 2026-09-25 inside single
// BEGIN; … (RAISE→ROLLBACK) transactions — 25 behavioural probes (14 forbidden writes each
// rejected with SQLSTATE 42501 and the right guard: prefix; 11 legitimate writes each
// succeeding, incl. suggest-pending, volunteer-approved, volunteer-withdraw, approve_resource
// + its resource_approved ledger credit, reject, admin direct edit, a service_role upsert,
// comment insert/reply, org-admin descriptive edits, and a platform-admin is_active toggle)
// and 9 mutation checks (drop each trigger / remove the volunteer carve-out / remove the admin
// bypass / flip the guard to SECURITY DEFINER — each flipped its probe, proving the element is
// load-bearing). This suite mirrors those results as prod-safe structural assertions.
//
// SQL SAFETY: single SELECT; every mutating word is a quoted literal / ILIKE pattern / column
// argument. No SQL verb appears at a line start or after ';' (prod-client WRITE_GUARD_RE).

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

const GATE_SQL = `
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261009000000'
  ) AS applied
`

const STATE_SQL = `
  SELECT
    -- ── I1 resources guard ─────────────────────────────────────────────────────────
    -- Trigger present, BEFORE INSERT+UPDATE, ROW, enabled (F1-F6 forbidden, L1/L2 legit).
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='resources' AND t.tgname='trg_resources_guard_moderation'
       AND (t.tgtype & 2)<>0 AND (t.tgtype & 1)<>0 AND (t.tgtype & 4)<>0 AND (t.tgtype & 16)<>0 AND t.tgenabled<>'D') AS res_trigger,
    -- SECURITY INVOKER is load-bearing (mutation M4): prosecdef must be FALSE, search_path pinned.
    (SELECT (NOT p.prosecdef) AND array_to_string(p.proconfig,',') ILIKE '%search_path%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='guard_resources_moderation_fields')                 AS res_fn_invoker_pinned,
    -- Greppable log prefix present (F1-F6 all raise 42501 with this prefix -> postgres_logs).
    (SELECT pg_get_functiondef(p.oid) ILIKE '%guard:resources_moderation_fields%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='guard_resources_moderation_fields')                 AS res_fn_prefix,
    -- D1 volunteer carve-out (L2, mutation M2): the INSERT branch allows approved volunteer rows.
    (SELECT pg_get_functiondef(p.oid) ILIKE '%is_volunteer_resource%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='guard_resources_moderation_fields')                 AS res_fn_volunteer_carve,
    -- Admin bypass (L6, mutation M3).
    (SELECT pg_get_functiondef(p.oid) ILIKE '%is_current_user_admin%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='guard_resources_moderation_fields')                 AS res_fn_admin_bypass,
    -- Volunteer self-withdraw transition (I1b): approved -> archived is permitted for the owner.
    (SELECT pg_get_functiondef(p.oid) ILIKE '%archived%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='guard_resources_moderation_fields')                 AS res_fn_withdraw_carve,
    -- The guard fn is never client-callable directly.
    has_function_privilege('authenticated','public.guard_resources_moderation_fields()','EXECUTE')  AS res_fn_auth_exec,
    has_function_privilege('anon','public.guard_resources_moderation_fields()','EXECUTE')            AS res_fn_anon_exec,
    -- I1b RLS: the volunteer withdraw policy exists (UPDATE) so archiving an approved listing
    -- matches a row (before P3.0 the only client UPDATE policy matched status='pending' only).
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='resources'
       AND policyname='Volunteers can withdraw their own listing' AND cmd='UPDATE')                 AS withdraw_policy,

    -- ── I6 post_comments guard ─────────────────────────────────────────────────────
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='post_comments' AND t.tgname='trg_post_comments_guard_is_hidden'
       AND (t.tgtype & 2)<>0 AND (t.tgtype & 1)<>0 AND (t.tgtype & 4)<>0 AND (t.tgtype & 16)<>0 AND t.tgenabled<>'D') AS cmt_trigger,
    (SELECT (NOT p.prosecdef) AND array_to_string(p.proconfig,',') ILIKE '%search_path%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='guard_post_comments_is_hidden')                      AS cmt_fn_invoker_pinned,
    (SELECT pg_get_functiondef(p.oid) ILIKE '%guard:post_comments_is_hidden%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='guard_post_comments_is_hidden')                      AS cmt_fn_prefix,
    -- Staff bypass reads profiles.is_staff (F7/F8/F9 forbidden for non-staff; staff pass).
    (SELECT pg_get_functiondef(p.oid) ILIKE '%is_staff%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='guard_post_comments_is_hidden')                      AS cmt_fn_staff,

    -- ── I3 organizations guard ─────────────────────────────────────────────────────
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='organizations' AND t.tgname='trg_organizations_guard_org_admin'
       AND (t.tgtype & 2)<>0 AND (t.tgtype & 1)<>0 AND (t.tgtype & 16)<>0 AND (t.tgtype & 4)=0 AND t.tgenabled<>'D') AS org_trigger,
    (SELECT (NOT p.prosecdef) AND array_to_string(p.proconfig,',') ILIKE '%search_path%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='guard_organizations_org_admin_update')               AS org_fn_invoker_pinned,
    (SELECT pg_get_functiondef(p.oid) ILIKE '%guard:organizations_admin_fields%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='guard_organizations_org_admin_update')               AS org_fn_prefix,
    -- Blocks is_active + created_by (F10/F11/F12), keeps admin bypass (L10).
    (SELECT pg_get_functiondef(p.oid) ILIKE '%created_by%' AND pg_get_functiondef(p.oid) ILIKE '%is_current_user_admin%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='guard_organizations_org_admin_update')               AS org_fn_blocks_and_bypass,
    -- org_type stays editable by org admins: it is NOT among the blocked "IS DISTINCT FROM"
    -- comparisons (the word org_type may appear in the HINT text, so match the blocking form).
    (SELECT pg_get_functiondef(p.oid) NOT ILIKE '%org_type is distinct%'
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='guard_organizations_org_admin_update')               AS org_fn_org_type_editable,

    -- ── Regressions / side fix ─────────────────────────────────────────────────────
    -- The W1.6a deactivation cascade still fires (I3 "cascade keeps working").
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='organizations' AND t.tgname='trg_organizations_cascade_deactivate'
       AND (t.tgtype & 16)<>0 AND t.tgenabled<>'D')                                                 AS cascade_trigger,
    -- approve_resource's credit path is untouched (L4 ledger credit).
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='resources' AND t.tgname='trg_engagement_resource_approved'
       AND (t.tgtype & 16)<>0 AND t.tgenabled<>'D')                                                 AS approved_credit_trigger,
    -- Side fix: the duplicate updated_at trigger is gone; exactly one remains on post_comments.
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='post_comments' AND t.tgname='set_post_comments_updated_at') AS dup_updated_at_gone,
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='post_comments' AND t.tgname='update_comments_updated_at'
       AND (t.tgtype & 2)<>0 AND t.tgenabled<>'D')                                                  AS kept_updated_at
`

maybeDescribe('30 — P3.0 moderation guards + volunteer withdraw (PROD read-only)', () => {
  it('[post-deploy] I1 — resources moderation-field guard (SECURITY INVOKER, carve-outs, log prefix)', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }
    const r = (await queryProd(STATE_SQL))[0]
    expect(Number(r.res_trigger), 'trg_resources_guard_moderation must fire BEFORE INSERT+UPDATE, ROW, enabled').toBe(1)
    expect(r.res_fn_invoker_pinned, 'the resources guard must be SECURITY INVOKER with a pinned search_path').toBe(true)
    expect(r.res_fn_prefix, 'the resources guard must raise with the guard:resources_moderation_fields prefix').toBe(true)
    expect(r.res_fn_volunteer_carve, 'the D1 volunteer carve-out must be present (L2)').toBe(true)
    expect(r.res_fn_admin_bypass, 'the admin bypass must be present (L6)').toBe(true)
    expect(r.res_fn_withdraw_carve, 'the volunteer approved->archived withdraw transition must be permitted (I1b)').toBe(true)
    expect(r.res_fn_auth_exec, 'the resources guard fn must NOT be directly EXECUTE-able by authenticated').toBe(false)
    expect(r.res_fn_anon_exec, 'the resources guard fn must NOT be directly EXECUTE-able by anon').toBe(false)
    expect(Number(r.withdraw_policy), 'the "Volunteers can withdraw their own listing" UPDATE policy must exist (I1b)').toBe(1)
  })

  it('[post-deploy] I6 — post_comments is_hidden staff-only guard', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }
    const r = (await queryProd(STATE_SQL))[0]
    expect(Number(r.cmt_trigger), 'trg_post_comments_guard_is_hidden must fire BEFORE INSERT+UPDATE, ROW, enabled').toBe(1)
    expect(r.cmt_fn_invoker_pinned, 'the comments guard must be SECURITY INVOKER with a pinned search_path').toBe(true)
    expect(r.cmt_fn_prefix, 'the comments guard must raise with the guard:post_comments_is_hidden prefix').toBe(true)
    expect(r.cmt_fn_staff, 'the comments guard must bypass for staff (profiles.is_staff)').toBe(true)
  })

  it('[post-deploy] I3 — organizations org-admin guard (active-only, ownership locked, org_type editable)', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }
    const r = (await queryProd(STATE_SQL))[0]
    expect(Number(r.org_trigger), 'trg_organizations_guard_org_admin must fire BEFORE UPDATE (not INSERT), ROW, enabled').toBe(1)
    expect(r.org_fn_invoker_pinned, 'the organizations guard must be SECURITY INVOKER with a pinned search_path').toBe(true)
    expect(r.org_fn_prefix, 'the organizations guard must raise with the guard:organizations_admin_fields prefix').toBe(true)
    expect(r.org_fn_blocks_and_bypass, 'the guard must block created_by and keep the platform-admin bypass').toBe(true)
    expect(r.org_fn_org_type_editable, 'org_type must stay editable by org admins (not in the blocked-column list)').toBe(true)
  })

  it('[post-deploy] regressions — cascade + approve credit intact, duplicate updated_at trigger removed', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }
    const r = (await queryProd(STATE_SQL))[0]
    expect(Number(r.cascade_trigger), 'the W1.6a org-deactivation cascade trigger must still fire (I3)').toBe(1)
    expect(Number(r.approved_credit_trigger), 'the resource_approved credit trigger must be untouched (L4)').toBe(1)
    expect(Number(r.dup_updated_at_gone), 'the duplicate set_post_comments_updated_at trigger must be gone').toBe(0)
    expect(Number(r.kept_updated_at), 'exactly the remaining update_comments_updated_at trigger must stay').toBe(1)
  })
})
