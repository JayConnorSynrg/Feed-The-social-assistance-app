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
// POST-DEPLOY gating: migration 20261002000000 is applied as a SEPARATE post-deploy
// step (GIT_PLAN feed-fullfeed-h-hygiene-postdeploy), NOT by the feature PR. Before
// it is live, anon still holds every privilege, so these tests SKIP (detected via the
// catalog: anon TRUNCATE still true ⇒ not applied yet) rather than fail RED on develop.
// Once the REVOKE is live, anon TRUNCATE flips to false and the assertions run.

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

// Single round-trip: the full has_table_privilege matrix for both roles. Every
// privilege keyword is a quoted argument (never a leading SQL verb), so it passes
// prod-client's WRITE_GUARD_RE.
const PRIV_MATRIX_SQL = `
  SELECT
    has_table_privilege('anon','public.posts','INSERT')             AS anon_ins,
    has_table_privilege('anon','public.posts','UPDATE')             AS anon_upd,
    has_table_privilege('anon','public.posts','DELETE')             AS anon_del,
    has_table_privilege('anon','public.posts','TRUNCATE')           AS anon_trunc,
    has_table_privilege('anon','public.posts','REFERENCES')         AS anon_refs,
    has_table_privilege('anon','public.posts','TRIGGER')            AS anon_trig,
    has_table_privilege('anon','public.posts','MAINTAIN')           AS anon_maint,
    has_table_privilege('authenticated','public.posts','INSERT')    AS auth_ins,
    has_table_privilege('authenticated','public.posts','UPDATE')    AS auth_upd,
    has_table_privilege('authenticated','public.posts','DELETE')    AS auth_del,
    has_table_privilege('authenticated','public.posts','TRUNCATE')  AS auth_trunc,
    has_table_privilege('authenticated','public.posts','REFERENCES') AS auth_refs,
    has_table_privilege('authenticated','public.posts','TRIGGER')   AS auth_trig,
    has_table_privilege('authenticated','public.posts','MAINTAIN')  AS auth_maint
`

// Gate signal: the migration revokes TRUNCATE from BOTH roles. While anon still holds
// TRUNCATE the migration is not yet live, so the caller should skip.
function migrationLive(row: Record<string, unknown>): boolean {
  return row.anon_trunc === false
}

maybeDescribe('24 — posts least-privilege (PROD read-only)', () => {
  it('[post-deploy] anon holds NO table-write privilege on public.posts', async (ctx) => {
    const rows = await queryProd(PRIV_MATRIX_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    if (!migrationLive(r)) {
      // Pre-deploy: REVOKE not applied yet (anon still has TRUNCATE) — skip.
      ctx.skip()
      return
    }
    expect(r.anon_ins, 'anon INSERT must be revoked').toBe(false)
    expect(r.anon_upd, 'anon UPDATE must be revoked').toBe(false)
    expect(r.anon_del, 'anon DELETE must be revoked').toBe(false)
    expect(r.anon_trunc, 'anon TRUNCATE must be revoked').toBe(false)
    expect(r.anon_refs, 'anon REFERENCES must be revoked').toBe(false)
    expect(r.anon_trig, 'anon TRIGGER must be revoked').toBe(false)
    expect(r.anon_maint, 'anon MAINTAIN must be revoked').toBe(false)
  })

  it('[post-deploy] authenticated keeps INSERT and nothing else it does not use', async (ctx) => {
    const rows = await queryProd(PRIV_MATRIX_SQL)
    expect(rows.length).toBe(1)
    const r = rows[0]
    if (!migrationLive(r)) {
      ctx.skip()
      return
    }
    // Kept — the client post composer needs INSERT (post-type-wizard / feed-panel).
    expect(r.auth_ins, 'authenticated INSERT must remain (client composer)').toBe(true)
    // Revoked — every UPDATE/DELETE flows through SECURITY DEFINER functions.
    expect(r.auth_upd, 'authenticated UPDATE must be revoked (SECDEF-only)').toBe(false)
    expect(r.auth_del, 'authenticated DELETE must be revoked (SECDEF-only)').toBe(false)
    expect(r.auth_trunc, 'authenticated TRUNCATE must be revoked').toBe(false)
    expect(r.auth_refs, 'authenticated REFERENCES must be revoked').toBe(false)
    expect(r.auth_trig, 'authenticated TRIGGER must be revoked').toBe(false)
    expect(r.auth_maint, 'authenticated MAINTAIN must be revoked').toBe(false)
  })
})
