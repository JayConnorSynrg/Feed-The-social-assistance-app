// 27-p2-1b-appreciation.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 27 — P2.1b peer appreciation gifts (feed-fullfeed-p2-1b-appreciation)
// Surface: appreciation_gifts table (RLS + grants, relacl + attacl → no client writes),
//          the give_appreciation SECDEF RPC (pinned search_path, authenticated-only EXECUTE),
//          the three CHECK constraints (self, item list, once-unique), the classifier
//          (appreciation_gift is PUBLIC + dim badge:appreciated), the table's absence from
//          supabase_realtime, and the I4 no-leak guard (no view/anon path exposes giver edges).
// Backend: supabase/migrations/20261006000000_p2_1b_appreciation.sql
//
// GATE ON THE LEDGER, NOT ON THE STATE. The migration applies as a SEPARATE post-deploy step
// recorded in supabase_migrations.schema_migrations. The suite skips ONLY while that ledger
// row is absent (pre-deploy). Once recorded, the assertions ALWAYS run.
//
// I3 (USER RULING): the public "Appreciated" LEVEL counts DISTINCT PEOPLE who gave, not gifts.
// The ledger credit is keyed actor=receiver, kind=appreciation_gift, target_id=GIVER, so
// UNIQUE(actor,kind,target) = one credit per (receiver, giver) pair — every later gift from the
// same giver still creates its gift row (all 12 items giftable) but adds no credit. The counter
// = number of distinct non-guest givers. reconcile iterates DISTINCT (receiver_id, giver_id).
//
// EMPIRICAL NOTE: every predicate below was validated against prod inside a single
// BEGIN; … ROLLBACK; transaction on 2026-09-23 (the migration applied cleanly on PG 17.6 and
// the give_appreciation calls exercised I1/I2/I3/I6, incl. distinct-giver counting: A gives B
// heart+smile → B counter 1; C gives B → 2; guest receiver + self/guest giver rejected;
// wipe-ledger→reconcile parity) — the assertions mirror those results.
//
// SQL SAFETY: single SELECT; every mutating word is a quoted literal / column argument.
// No SQL verb appears at a line start or after ';' (prod-client WRITE_GUARD_RE).

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

const GATE_SQL = `
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261006000000'
  ) AS applied
`

const STATE_SQL = `
  SELECT
    -- Table exists + RLS on.
    (SELECT count(*) FROM information_schema.tables
       WHERE table_schema='public' AND table_name='appreciation_gifts')                    AS tbl_exists,
    (SELECT relrowsecurity FROM pg_class WHERE oid='public.appreciation_gifts'::regclass)   AS rls,
    -- I2: NO client writes — table-level AND column-level (relacl + attacl) for anon+auth.
    has_table_privilege('authenticated','public.appreciation_gifts','SELECT')               AS auth_select,
    has_table_privilege('authenticated','public.appreciation_gifts','INSERT')               AS auth_insert,
    has_table_privilege('authenticated','public.appreciation_gifts','UPDATE')               AS auth_update,
    has_table_privilege('authenticated','public.appreciation_gifts','DELETE')               AS auth_delete,
    has_any_column_privilege('authenticated','public.appreciation_gifts','INSERT')          AS auth_col_insert,
    has_any_column_privilege('authenticated','public.appreciation_gifts','UPDATE')          AS auth_col_update,
    has_table_privilege('anon','public.appreciation_gifts','SELECT')                        AS anon_select,
    has_any_column_privilege('anon','public.appreciation_gifts','INSERT')                   AS anon_col_insert,
    -- Only a party may read a row (RLS policy references both giver_id and receiver_id).
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='appreciation_gifts'
       AND cmd='SELECT' AND coalesce(qual,'') ILIKE '%giver_id%' AND coalesce(qual,'') ILIKE '%receiver_id%') AS select_parties_policy,
    -- No client write policy at all (writes go only through the SECDEF RPC).
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='appreciation_gifts'
       AND cmd IN ('INSERT','UPDATE','DELETE','ALL'))                                       AS write_policies,
    -- The three CHECK constraints: not-self, item allow-list, once-unique.
    (SELECT count(*) FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid
       WHERE cl.relname='appreciation_gifts' AND c.contype='c'
       AND pg_get_constraintdef(c.oid) ILIKE '%giver_id <> receiver_id%')                   AS chk_not_self,
    (SELECT count(*) FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid
       WHERE cl.relname='appreciation_gifts' AND c.contype='c'
       AND pg_get_constraintdef(c.oid) ILIKE '%seedling%')                                  AS chk_item_list,
    (SELECT count(*) FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid
       WHERE cl.relname='appreciation_gifts' AND c.contype='u'
       AND pg_get_constraintdef(c.oid) ILIKE '%giver_id, receiver_id, item%')               AS chk_once_unique,
    -- give_appreciation: SECDEF + pinned search_path; EXECUTE for authenticated only.
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='give_appreciation'
       AND p.prosecdef AND array_to_string(p.proconfig,',') ILIKE '%search_path%')          AS give_secdef_pinned,
    has_function_privilege('authenticated','public.give_appreciation(uuid,text,uuid)','EXECUTE') AS give_auth_exec,
    has_function_privilege('anon','public.give_appreciation(uuid,text,uuid)','EXECUTE')      AS give_anon_exec,
    -- Classifier: appreciation_gift is PUBLIC (level surfaces) with dim badge:appreciated.
    public.engagement_is_public('appreciation_gift')                                        AS appr_public,
    public.engagement_community_dim('appreciation_gift')                                    AS appr_dim,
    -- Table must NOT be in the realtime publication (no WAL edge exposure).
    (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime'
       AND schemaname='public' AND tablename='appreciation_gifts')                          AS published,
    -- I4 NO-LEAK: no VIEW in public references appreciation_gifts (a view could re-expose the
    -- giver→receiver edge outside RLS); and reconcile stays non-client-executable.
    (SELECT count(*) FROM pg_views WHERE schemaname='public' AND definition ILIKE '%appreciation_gifts%') AS views_over_gifts,
    has_function_privilege('authenticated','public.reconcile_engagement(uuid)','EXECUTE')    AS reconcile_auth_exec,
    -- Regression guard: the P2.1a public/private split for 'like' + 'safety_alert_verified'
    -- is unchanged by this wave (the classifier CREATE OR REPLACE must not disturb them).
    public.engagement_is_public('like')                                                     AS like_public,
    public.engagement_is_public('safety_alert_verified')                                    AS sav_public
`

maybeDescribe('27 — P2.1b appreciation (PROD read-only)', () => {
  it('[post-deploy] I2 — appreciation_gifts is server-write-only, party-read, RLS on', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) {
      ctx.skip()
      return
    }
    const rows = await queryProd(STATE_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    expect(Number(r.tbl_exists), 'appreciation_gifts table must exist').toBe(1)
    expect(r.rls, 'appreciation_gifts RLS must be enabled').toBe(true)
    // Reads: authenticated may SELECT (RLS-scoped to the two parties); anon nothing.
    expect(r.auth_select, 'authenticated may SELECT (RLS-scoped)').toBe(true)
    expect(r.anon_select, 'anon must NOT read gifts').toBe(false)
    expect(Number(r.select_parties_policy), 'SELECT policy must scope to giver OR receiver').toBe(1)
    // Writes: none, at table OR column level, for authenticated or anon.
    expect(r.auth_insert, 'authenticated must NOT INSERT gifts (table)').toBe(false)
    expect(r.auth_update, 'authenticated must NOT UPDATE gifts (table)').toBe(false)
    expect(r.auth_delete, 'authenticated must NOT DELETE gifts (permanent)').toBe(false)
    expect(r.auth_col_insert, 'authenticated must NOT INSERT any column').toBe(false)
    expect(r.auth_col_update, 'authenticated must NOT UPDATE any column').toBe(false)
    expect(r.anon_col_insert, 'anon must NOT INSERT any column').toBe(false)
    expect(Number(r.write_policies), 'appreciation_gifts must have NO client write policy').toBe(0)
  })

  it('[post-deploy] I1/I3/I4/I5 — constraints, SECDEF RPC lockdown, classifier, no leak', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) {
      ctx.skip()
      return
    }
    const rows = await queryProd(STATE_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    // I1: constraints — self-block, item allow-list, once-unique.
    expect(Number(r.chk_not_self), 'CHECK giver_id <> receiver_id must exist').toBe(1)
    expect(Number(r.chk_item_list), 'CHECK item allow-list must exist').toBe(1)
    expect(Number(r.chk_once_unique), 'UNIQUE(giver_id,receiver_id,item) must exist').toBe(1)
    // give_appreciation — SECDEF+pinned, authenticated-only EXECUTE.
    expect(Number(r.give_secdef_pinned), 'give_appreciation must be SECDEF with a pinned search_path').toBe(1)
    expect(r.give_auth_exec, 'authenticated must EXECUTE give_appreciation').toBe(true)
    expect(r.give_anon_exec, 'anon must NOT EXECUTE give_appreciation').toBe(false)
    // I4: PUBLIC level, dim appreciated; no realtime; no view leaks the edge; reconcile locked.
    expect(r.appr_public, 'appreciation_gift must be PUBLIC (level surfaces)').toBe(true)
    expect(r.appr_dim, 'appreciation_gift community dim must be badge:appreciated').toBe('badge:appreciated')
    expect(Number(r.published), 'appreciation_gifts must NOT be in supabase_realtime').toBe(0)
    expect(Number(r.views_over_gifts), 'no public VIEW may reference appreciation_gifts (edge leak)').toBe(0)
    expect(r.reconcile_auth_exec, 'reconcile_engagement must stay non-client-executable').toBe(false)
    // Regression: P2.1a public/private classification is undisturbed by this wave.
    expect(r.like_public, 'like must remain public').toBe(true)
    expect(r.sav_public, 'safety_alert_verified must remain private').toBe(false)
  })
})
