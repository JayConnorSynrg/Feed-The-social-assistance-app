// 24-posts-privilege-least.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 24 — posts least-privilege (Invariant 2, feed-fullfeed-h-hygiene)
// Surface: public.posts table grants (pg_class.relacl)
// Backend: supabase/migrations/20261002000000_posts_privilege_least.sql
//
// Asserts each role on public.posts holds EXACTLY the privileges its real write
// paths use:
//   anon          → no table-write privilege at all (read-only; SELECT is column-level)
//   authenticated → INSERT only (client composer); UPDATE/DELETE flow through SECDEF fns
//
// GATE ON THE LEDGER, NOT ON THE PRIVILEGE STATE. Migration 20261002000000 is applied
// as a SEPARATE post-deploy step (GIT_PLAN feed-fullfeed-h-hygiene-postdeploy) and then
// recorded in supabase_migrations.schema_migrations by the backfill in the SAME step.
// The test skips ONLY while that ledger row is absent (pre-deploy). Once the migration
// is recorded as applied, the assertions ALWAYS run — so a later privilege REGRESSION
// (e.g. a full re-grant of UPDATE/DELETE) FAILS the suite instead of silently skipping.
// (A privilege-based gate would wrongly treat a revert as "not applied yet" and skip.)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

// One round-trip: ledger presence of the migration + the full has_table_privilege
// matrix for both roles. Every privilege keyword is a quoted argument (never a leading
// SQL verb), so this passes prod-client's WRITE_GUARD_RE.
const GATE_AND_MATRIX_SQL = `
  SELECT
    EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE version = '20261002000000'
    )                                                                AS applied,
    has_table_privilege('anon','public.posts','INSERT')             AS anon_ins,
    has_table_privilege('anon','public.posts','UPDATE')             AS anon_upd,
    has_table_privilege('anon','public.posts','DELETE')             AS anon_del,
    has_table_privilege('anon','public.posts','TRUNCATE')           AS anon_trunc,
    has_table_privilege('anon','public.posts','REFERENCES')         AS anon_refs,
    has_table_privilege('anon','public.posts','TRIGGER')            AS anon_trig,
    has_table_privilege('authenticated','public.posts','INSERT')    AS auth_ins,
    has_table_privilege('authenticated','public.posts','UPDATE')    AS auth_upd,
    has_table_privilege('authenticated','public.posts','DELETE')    AS auth_del,
    has_table_privilege('authenticated','public.posts','TRUNCATE')  AS auth_trunc,
    has_table_privilege('authenticated','public.posts','REFERENCES') AS auth_refs,
    has_table_privilege('authenticated','public.posts','TRIGGER')   AS auth_trig
`
// MAINTAIN is intentionally omitted from the matrix: it is a PG17+ privilege and the
// migration revokes it only under a server-version guard, so it is not a portable,
// stable assertion target. The ledger-row gate governs when the rest runs.

maybeDescribe('24 — posts least-privilege (PROD read-only)', () => {
  it('[post-deploy] anon holds NO table-write privilege on public.posts', async (ctx) => {
    const rows = await queryProd(GATE_AND_MATRIX_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    if (r.applied !== true) {
      // Pre-deploy: migration 20261002000000 not yet recorded in the ledger — skip.
      ctx.skip()
      return
    }
    expect(r.anon_ins, 'anon INSERT must be revoked').toBe(false)
    expect(r.anon_upd, 'anon UPDATE must be revoked').toBe(false)
    expect(r.anon_del, 'anon DELETE must be revoked').toBe(false)
    expect(r.anon_trunc, 'anon TRUNCATE must be revoked').toBe(false)
    expect(r.anon_refs, 'anon REFERENCES must be revoked').toBe(false)
    expect(r.anon_trig, 'anon TRIGGER must be revoked').toBe(false)
  })

  it('[post-deploy] authenticated keeps INSERT and nothing else it does not use', async (ctx) => {
    const rows = await queryProd(GATE_AND_MATRIX_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    if (r.applied !== true) {
      ctx.skip()
      return
    }
    // Kept — the client post composer needs INSERT (post-type-wizard / feed-panel / programs-panel).
    expect(r.auth_ins, 'authenticated INSERT must remain (client composer)').toBe(true)
    // Revoked — every UPDATE/DELETE flows through SECURITY DEFINER functions.
    expect(r.auth_upd, 'authenticated UPDATE must be revoked (SECDEF-only)').toBe(false)
    expect(r.auth_del, 'authenticated DELETE must be revoked (SECDEF-only)').toBe(false)
    expect(r.auth_trunc, 'authenticated TRUNCATE must be revoked').toBe(false)
    expect(r.auth_refs, 'authenticated REFERENCES must be revoked').toBe(false)
    expect(r.auth_trig, 'authenticated TRIGGER must be revoked').toBe(false)
  })
})
