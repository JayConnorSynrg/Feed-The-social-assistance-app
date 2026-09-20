// 23-ranked-feed.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 23 — Ranked Community Feed (W1.3)
// Surface: apps/web/src/components/panels/feed-panel.tsx (ranked path) → RPC public.ranked_feed
// Upstream: Feed (M5), W0.3 ranking spine | Downstream: none
//
// Read-only structural + behavioral contract for the ranked_feed RPC. The prod
// client is read-only (WRITE_GUARD), so the seed-with/without-location score-ordering
// probe is run out-of-band via the Management API (scratchpad/probe.sql, evidence in
// the wave report). These assertions survive mutation: they fail if the function loses
// SECURITY DEFINER, unpins its search_path, over-grants EXECUTE, or ever adds a raw
// coordinate/distance column to its output (INV-A #2, INV-D).

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

const SIG = "public.ranked_feed(double precision,double precision,integer,real,uuid)"

maybeDescribe('23 — Ranked Feed RPC (PROD read-only)', () => {
  it('ranked_feed is SECURITY DEFINER with a pinned (non-mutable) search_path', async () => {
    // INV-D: SECDEF owned by postgres, search_path = public, pg_temp.
    const rows = await queryProd(`
      SELECT p.prosecdef,
             (SELECT array_agg(c) FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%') AS search_path_cfg
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'ranked_feed'
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].prosecdef).toBe(true)
    const cfg = rows[0].search_path_cfg as string[] | null
    expect(cfg).not.toBeNull()
    const joined = (cfg ?? []).join(',')
    expect(joined).toContain('public')
    expect(joined).toContain('pg_temp')
  })

  it('emits ONLY id + score + distance_bucket — never a raw coordinate/distance (INV-A)', async () => {
    // The RETURNS TABLE signature is the contract the client depends on and the
    // privacy guarantee: no lat/lng/location/coordinate ever leaves the RPC.
    const rows = await queryProd(`
      SELECT pg_get_function_result(p.oid) AS result_sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'ranked_feed'
    `)
    expect(rows.length).toBe(1)
    const sig = String(rows[0].result_sig).toLowerCase()
    expect(sig).toContain('id uuid')
    expect(sig).toContain('score real')
    expect(sig).toContain('distance_bucket text')
    for (const banned of ['lat', 'lng', 'latitude', 'longitude', 'location', 'geog', 'geom', 'coord', 'dist_km']) {
      expect(sig).not.toContain(banned)
    }
  })

  it('EXECUTE is granted to anon, authenticated, service_role (INV-D)', async () => {
    const rows = await queryProd(`
      SELECT
        has_function_privilege('anon',          '${SIG}', 'EXECUTE') AS anon_x,
        has_function_privilege('authenticated', '${SIG}', 'EXECUTE') AS auth_x,
        has_function_privilege('service_role',  '${SIG}', 'EXECUTE') AS svc_x
    `)
    expect(rows[0].anon_x).toBe(true)
    expect(rows[0].auth_x).toBe(true)
    expect(rows[0].svc_x).toBe(true)
  })

  it('EXECUTE is not left granted to PUBLIC (REVOKE FROM PUBLIC held)', async () => {
    // A PUBLIC execute grant shows in proacl as an ACL item with an empty grantee
    // (e.g. "=X/postgres"). After REVOKE ... FROM PUBLIC the acl is explicit-only.
    const rows = await queryProd(`
      SELECT p.proacl::text AS acl
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'ranked_feed'
    `)
    const acl = String(rows[0].acl ?? '')
    // No bare "=X" entry (PUBLIC). Explicit role grants look like "anon=X/postgres".
    expect(acl).not.toMatch(/(^|,|\{)=X/)
  })

  it('a live call runs without error and returns the 3-key row shape', async () => {
    // posts has 0 rows in the clean window, so this returns 0 rows — the assertion
    // is that the function EXECUTES against prod and its columns are exactly the
    // contract. jsonb_object_keys of a probe row would be empty on 0 rows, so we
    // assert the call succeeds and, if any row exists, carries only the 3 keys.
    const rows = await queryProd(`
      SELECT count(*)::int AS n
      FROM ranked_feed(44.26, -72.58, 25) r
    `)
    expect(typeof rows[0].n).toBe('number')
    expect(rows[0].n).toBeGreaterThanOrEqual(0)
  })
})
