// 26-p2-1a-engagement.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 26 — P2.1a engagement ledger + badges + unblock (feed-fullfeed-p2-1a-engagement)
// Surface: engagement_events / user_engagement_counters / badge_config / opt_in_declines
//          RLS + grants, profiles.badge_summary SELECT grant + UPDATE denial, the 16
//          source-table ledger triggers (AFTER + ROW + enabled), the new tables' absence
//          from supabase_realtime, the internal-write-fn EXECUTE lockdown, and the
//          unblock_opt_in / reconcile_engagement SECDEF + pinned-search_path + grants.
// Backend: supabase/migrations/20261005000000_p2_1a_engagement.sql
//
// GATE ON THE LEDGER, NOT ON THE STATE. The migration is applied as a SEPARATE
// post-deploy step (GIT_PLAN feed-fullfeed-p2-1a-engagement-postdeploy) and recorded in
// supabase_migrations.schema_migrations in the SAME step. The suite skips ONLY while
// that ledger row is absent (pre-deploy). Once recorded, the assertions ALWAYS run.
//
// SQL SAFETY: single SELECT; every mutating word is a quoted literal / column argument.
// No SQL verb appears at a line start or after ';' (prod-client WRITE_GUARD_RE).

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

// The gate is a STANDALONE query: pre-apply, the new tables/columns/functions do not
// exist, so the state query below would error. We therefore check the ledger row first
// and only run the state query once it is present.
const GATE_SQL = `
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261005000000'
  ) AS applied
`

const STATE_SQL = `
  SELECT
    -- I4: profiles.badge_summary is public-readable (column grant, since profiles has no
    -- table-level SELECT grant). Sensitive columns stay private (regression guard).
    has_column_privilege('anon','public.profiles','badge_summary','SELECT')               AS anon_badge_read,
    has_column_privilege('authenticated','public.profiles','badge_summary','SELECT')      AS auth_badge_read,
    has_column_privilege('anon','public.profiles','full_name','SELECT')                   AS anon_fullname_read,
    -- I2: engagement_events — no client writes, own-read only, RLS on.
    has_table_privilege('authenticated','public.engagement_events','INSERT')              AS ev_auth_insert,
    has_table_privilege('authenticated','public.engagement_events','SELECT')              AS ev_auth_select,
    has_table_privilege('anon','public.engagement_events','SELECT')                       AS ev_anon_select,
    (SELECT relrowsecurity FROM pg_class WHERE oid='public.engagement_events'::regclass)  AS ev_rls,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='engagement_events'
       AND cmd='SELECT' AND coalesce(qual,'') ILIKE '%actor_id%')                         AS ev_select_own,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='engagement_events'
       AND cmd IN ('INSERT','UPDATE','DELETE'))                                           AS ev_write_policies,
    -- I2: user_engagement_counters — own-read, RLS on, no client writes.
    (SELECT relrowsecurity FROM pg_class WHERE oid='public.user_engagement_counters'::regclass) AS ctr_rls,
    has_table_privilege('authenticated','public.user_engagement_counters','UPDATE')       AS ctr_auth_update,
    -- badge_config — public read, RLS on, no client writes.
    has_table_privilege('anon','public.badge_config','SELECT')                            AS cfg_anon_select,
    has_table_privilege('authenticated','public.badge_config','UPDATE')                   AS cfg_auth_update,
    (SELECT relrowsecurity FROM pg_class WHERE oid='public.badge_config'::regclass)       AS cfg_rls,
    -- opt_in_declines — author-read only (private marker), RLS on, not anon-readable.
    (SELECT relrowsecurity FROM pg_class WHERE oid='public.opt_in_declines'::regclass)    AS mark_rls,
    has_table_privilege('anon','public.opt_in_declines','SELECT')                         AS mark_anon_select,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='opt_in_declines'
       AND cmd='SELECT' AND coalesce(qual,'') ILIKE '%author_id%')                        AS mark_select_author,
    -- badge_summary is server-maintained: authenticated may READ but never WRITE it.
    has_column_privilege('authenticated','public.profiles','badge_summary','UPDATE')      AS auth_badge_update,
    -- The new tables must NOT be in the realtime publication (no WAL exposure).
    (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public'
       AND tablename IN ('engagement_events','user_engagement_counters','badge_config','opt_in_declines','user_private_badge_summary')) AS new_tables_published,
    -- B2: user_private_badge_summary — owner-only RLS, no client writes, not anon-readable.
    (SELECT relrowsecurity FROM pg_class WHERE oid='public.user_private_badge_summary'::regclass) AS priv_rls,
    has_table_privilege('anon','public.user_private_badge_summary','SELECT')            AS priv_anon_select,
    has_table_privilege('authenticated','public.user_private_badge_summary','SELECT')   AS priv_auth_select,
    has_table_privilege('authenticated','public.user_private_badge_summary','INSERT')   AS priv_auth_insert,
    has_table_privilege('authenticated','public.user_private_badge_summary','UPDATE')   AS priv_auth_update,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='user_private_badge_summary'
       AND cmd='SELECT' AND coalesce(qual,'') ILIKE '%user_id%')                        AS priv_select_own,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='user_private_badge_summary'
       AND cmd IN ('INSERT','UPDATE','DELETE','ALL'))                                   AS priv_write_policies,
    -- The 16 source-table ledger triggers: present, ENABLED, AFTER + ROW, right event.
    -- tgtype bit 1 = ROW, bit 2 = BEFORE (must be 0 => AFTER), bit 4 = INSERT, bit 16 = UPDATE.
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND t.tgenabled <> 'D' AND (t.tgtype & 1) <> 0 AND (t.tgtype & 2) = 0 AND (
         (c.relname='post_likes'          AND t.tgname='trg_engagement_post_like'           AND (t.tgtype & 4) <> 0) OR
         (c.relname='poll_votes'          AND t.tgname='trg_engagement_poll_vote'           AND (t.tgtype & 4) <> 0) OR
         (c.relname='follows'             AND t.tgname='trg_engagement_follow'              AND (t.tgtype & 4) <> 0) OR
         (c.relname='post_comments'       AND t.tgname='trg_engagement_comment'             AND (t.tgtype & 4) <> 0) OR
         (c.relname='petition_signatures' AND t.tgname='trg_engagement_petition_signature'  AND (t.tgtype & 4) <> 0) OR
         (c.relname='posts'               AND t.tgname='trg_engagement_post_created'        AND (t.tgtype & 4) <> 0) OR
         (c.relname='event_checkins'      AND t.tgname='trg_engagement_event_checkin'       AND (t.tgtype & 4) <> 0) OR
         (c.relname='safety_alert_votes'  AND t.tgname='trg_engagement_safety_alert_vote'   AND (t.tgtype & 4) <> 0) OR
         (c.relname='messages'            AND t.tgname='trg_engagement_message'             AND (t.tgtype & 4) <> 0) OR
         (c.relname='resource_bookmarks'  AND t.tgname='trg_engagement_resource_bookmark'   AND (t.tgtype & 4) <> 0) OR
         (c.relname='saved_resources'     AND t.tgname='trg_engagement_saved_resource'      AND (t.tgtype & 4) <> 0) OR
         (c.relname='resource_opt_ins'    AND t.tgname='trg_engagement_opt_in'              AND (t.tgtype & 16) <> 0) OR
         (c.relname='conversations'       AND t.tgname='trg_engagement_conversation'        AND (t.tgtype & 16) <> 0) OR
         (c.relname='reviews'             AND t.tgname='trg_engagement_review'              AND (t.tgtype & 4) <> 0) OR
         (c.relname='safety_alerts'       AND t.tgname='trg_engagement_safety_alert_verify'  AND (t.tgtype & 16) <> 0) OR
         (c.relname='resources'           AND t.tgname='trg_engagement_resource_approved'   AND (t.tgtype & 16) <> 0)
       ))                                                                                  AS source_triggers,
    -- The internal write helper + recompute fns are NOT client-executable.
    has_function_privilege('authenticated','public.record_engagement_event(uuid,text,text,uuid,text,text,text,boolean)','EXECUTE') AS rec_auth_exec,
    has_function_privilege('anon','public.recompute_badge_summary(uuid)','EXECUTE')       AS rbs_anon_exec,
    has_function_privilege('authenticated','public.reconcile_engagement(uuid)','EXECUTE') AS reconcile_auth_exec,
    has_function_privilege('anon','public.reconcile_engagement(uuid)','EXECUTE')          AS reconcile_anon_exec,
    has_function_privilege('anon','public.record_engagement_event(uuid,text,text,uuid,text,text,text,boolean)','EXECUTE') AS rec_anon_exec,
    -- unblock_opt_in is client-callable by authenticated only.
    has_function_privilege('authenticated','public.unblock_opt_in(uuid)','EXECUTE')       AS unblock_auth_exec,
    has_function_privilege('anon','public.unblock_opt_in(uuid)','EXECUTE')                AS unblock_anon_exec,
    -- unblock_opt_in + reconcile_engagement are SECDEF with a pinned search_path.
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname IN ('unblock_opt_in','reconcile_engagement')
       AND p.prosecdef AND array_to_string(p.proconfig, ',') ILIKE '%search_path%')       AS secdef_pinned,
    -- The transition guard is the P2.0 body (no declined->pending GUC bypass — unblock deletes).
    (SELECT md5(prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='enforce_opt_in_transition')                AS transition_md5
`

// The P2.0 enforce_opt_in_transition prosrc md5 (live @ ndtpovonpadugthmcntl, 2026-09-23).
// P2.1a must NOT touch this function, so md5 must be unchanged post-apply.
const P20_TRANSITION_MD5 = 'f3bc362fce1361a5717007ea2f7a88e7'

maybeDescribe('26 — P2.1a engagement (PROD read-only)', () => {
  it('[post-deploy] I2/I4 — server-only ledger writes, public summary, private marker', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) {
      ctx.skip()
      return
    }
    const rows = await queryProd(STATE_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    // I4: badge_summary public-readable; PII column still private.
    expect(r.anon_badge_read, 'anon must read profiles.badge_summary').toBe(true)
    expect(r.auth_badge_read, 'authenticated must read profiles.badge_summary').toBe(true)
    expect(r.anon_fullname_read, 'profiles.full_name must remain private (regression)').toBe(false)
    // I2: engagement_events — read-own only, no client writes, RLS on.
    expect(r.ev_auth_insert, 'authenticated must NOT INSERT engagement_events').toBe(false)
    expect(r.ev_auth_select, 'authenticated may SELECT engagement_events (RLS-scoped)').toBe(true)
    expect(r.ev_anon_select, 'anon must NOT read the ledger').toBe(false)
    expect(r.ev_rls, 'engagement_events RLS must be enabled').toBe(true)
    expect(Number(r.ev_select_own), 'engagement_events must have an own-read policy').toBe(1)
    expect(Number(r.ev_write_policies), 'engagement_events must have NO client write policy').toBe(0)
    // counters — RLS on, no client writes.
    expect(r.ctr_rls, 'user_engagement_counters RLS must be enabled').toBe(true)
    expect(r.ctr_auth_update, 'authenticated must NOT UPDATE counters').toBe(false)
    // badge_config — public read, no client writes.
    expect(r.cfg_anon_select, 'anon must read badge_config').toBe(true)
    expect(r.cfg_auth_update, 'authenticated must NOT UPDATE badge_config').toBe(false)
    expect(r.cfg_rls, 'badge_config RLS must be enabled').toBe(true)
    // opt_in_declines — author-only private marker.
    expect(r.mark_rls, 'opt_in_declines RLS must be enabled').toBe(true)
    expect(r.mark_anon_select, 'anon must NOT read the private decline marker').toBe(false)
    expect(Number(r.mark_select_author), 'opt_in_declines must have an author-only read policy').toBe(1)
    // badge_summary is server-maintained: no client UPDATE.
    expect(r.auth_badge_update, 'authenticated must NOT UPDATE profiles.badge_summary').toBe(false)
    // The new tables must be absent from the realtime publication.
    expect(Number(r.new_tables_published), 'the 5 new tables must NOT be in supabase_realtime').toBe(0)
    // B2: private summary — owner-only RLS, no client writes.
    expect(r.priv_rls, 'user_private_badge_summary RLS must be enabled').toBe(true)
    expect(r.priv_anon_select, 'anon must NOT read the private summary').toBe(false)
    expect(r.priv_auth_select, 'authenticated may SELECT (RLS-scoped to owner)').toBe(true)
    expect(r.priv_auth_insert, 'authenticated must NOT INSERT the private summary').toBe(false)
    expect(r.priv_auth_update, 'authenticated must NOT UPDATE the private summary').toBe(false)
    expect(Number(r.priv_select_own), 'private summary must have an owner-only read policy').toBe(1)
    expect(Number(r.priv_write_policies), 'private summary must have NO client write policy').toBe(0)
  })

  it('[post-deploy] I1/I5/I7 — ledger triggers, fn lockdown, unblock+reconcile', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) {
      ctx.skip()
      return
    }
    const rows = await queryProd(STATE_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    // I1: all 16 source triggers present, enabled, AFTER + ROW, right event.
    expect(Number(r.source_triggers), 'all 16 engagement source triggers must be present, enabled, AFTER+ROW').toBe(16)
    // Internal write helpers are not client-executable.
    expect(r.rec_auth_exec, 'record_engagement_event must NOT be client-executable').toBe(false)
    expect(r.rbs_anon_exec, 'recompute_badge_summary must NOT be anon-executable').toBe(false)
    expect(r.reconcile_auth_exec, 'reconcile_engagement must NOT be authenticated-executable').toBe(false)
    expect(r.reconcile_anon_exec, 'reconcile_engagement must NOT be anon-executable').toBe(false)
    expect(r.rec_anon_exec, 'record_engagement_event must NOT be anon-executable').toBe(false)
    // I5: unblock RPC is authenticated-only; reconcile+unblock are SECDEF+pinned.
    expect(r.unblock_auth_exec, 'authenticated must EXECUTE unblock_opt_in').toBe(true)
    expect(r.unblock_anon_exec, 'anon must NOT EXECUTE unblock_opt_in').toBe(false)
    expect(Number(r.secdef_pinned), 'unblock_opt_in + reconcile_engagement must be SECDEF with a pinned search_path').toBe(2)
    // The transition guard is byte-identical to the P2.0 body — unblock deletes, no edge added.
    expect(r.transition_md5, 'enforce_opt_in_transition must be the byte-identical P2.0 body').toBe(P20_TRANSITION_MD5)
  })
})
