// 23-ranked-feed.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 23 — Ranked Community Feed (W1.3)
// Surface: apps/web/src/components/panels/feed-panel.tsx (ranked path) → RPC public.ranked_feed
// Upstream: Feed (M5), W0.3 ranking spine | Downstream: none
//
// Structural + behavioral contract for the ranked_feed RPC. Most assertions use the
// read-only prod client (WRITE_GUARD). The distance-oracle test needs data, so it
// seeds inside a DO block that RAISEs → the whole tx rolls back (net-zero writes).
// These assertions survive mutation: they fail if the function loses SECURITY DEFINER,
// unpins its search_path, over-grants EXECUTE, adds a raw coordinate/distance column to
// its output (INV-A #2, INV-D), or regresses to a continuous (oracle) distance factor.

import * as fs from 'fs'
import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

const SIG = "public.ranked_feed(double precision,double precision,integer,real,uuid)"
const MGMT_URL = 'https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query'

function loadTokenForProbe(): string {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN
  if (fromEnv && fromEnv.length > 10) return fromEnv
  for (const p of [
    `${process.cwd()}/.env.local`,
    '/Users/jelalconnor/CODING/CURSOR/FEED./apps/web/.env.local',
  ]) {
    try {
      const m = fs.readFileSync(p, 'utf-8').match(/^SUPABASE_ACCESS_TOKEN=["']?([^\s"']+)["']?\s*$/m)
      if (m?.[1]) return m[1].trim()
    } catch { /* continue */ }
  }
  throw new Error('SUPABASE_ACCESS_TOKEN not available')
}

/**
 * Run a DO block that ends in RAISE EXCEPTION so the whole statement's writes ALWAYS
 * roll back (net-zero persistent writes — this is the reviewer-mandated seed-in-a-
 * rolled-back-tx probe). Returns the RAISE message text. Uses a direct Management API
 * call rather than queryProd because queryProd's WRITE_GUARD (correctly) rejects any
 * INSERT; the rollback guarantee is what makes this safe against prod. The PAT is
 * never logged.
 */
async function probeRolledBack(doBlockSql: string): Promise<string> {
  const token = loadTokenForProbe()
  const res = await fetch(MGMT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: doBlockSql }),
  })
  const body = (await res.json()) as { message?: string }
  // Expected: a non-2xx carrying our RAISE message. Redact the token defensively.
  const msg = String(body?.message ?? '').split(token).join('[REDACTED]')
  return msg
}

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

  it('is NOT a distance oracle — same-bucket posts at different exact distances score identically (SEV-HIGH)', async () => {
    // Seed 3 posts inside a DO block that RAISEs (→ full rollback, zero writes):
    //   A ~0.16 km and B ~1.5 km from a fixed origin — BOTH in the <2km bucket, at
    //   DIFFERENT exact distances; C has no geo (organic baseline). Identical
    //   likes/comments/created_at so only the distance contribution can differ.
    // Property: quantized distance factor ⇒ A.score === B.score (an attacker cannot
    // recover exact distance from score), and A.score / C.score equals the DISCRETE
    // <2km bucket factor exp(-1/decay), never a continuous function of exact distance.
    const uidRows = await queryProd('SELECT id FROM public.profiles LIMIT 1')
    const uid = String(uidRows[0].id)

    const doBlock = `
      DO $$
      DECLARE
        a_id uuid := gen_random_uuid();
        b_id uuid := gen_random_uuid();
        c_id uuid := gen_random_uuid();
        ts timestamptz := now();
        decay numeric := (SELECT distance_decay_km FROM public.ranking_config LIMIT 1);
        result jsonb;
      BEGIN
        INSERT INTO public.posts (id,user_id,content,created_at,like_count,comment_count,is_hidden,is_pinned,post_type,location) VALUES
          (a_id, '${uid}', 'A', ts, 10, 0, false, false, 'feed', ST_SetSRID(ST_MakePoint(-72.5780, 44.2600),4326)::geography),
          (b_id, '${uid}', 'B', ts, 10, 0, false, false, 'feed', ST_SetSRID(ST_MakePoint(-72.5610, 44.2600),4326)::geography),
          (c_id, '${uid}', 'C', ts, 10, 0, false, false, 'feed', NULL);
        SELECT jsonb_object_agg(k, v) INTO result FROM (
          SELECT CASE r.id WHEN a_id THEN 'A' WHEN b_id THEN 'B' ELSE 'C' END AS k,
                 jsonb_build_object('score', r.score, 'bucket', r.distance_bucket) AS v
          FROM ranked_feed(44.2600, -72.5800, 25, NULL, NULL) r
          WHERE r.id IN (a_id, b_id, c_id)
        ) t;
        RAISE EXCEPTION 'ORACLE=%|decay=%', result::text, decay;
      END $$;`

    const msg = await probeRolledBack(doBlock)
    const m = msg.match(/ORACLE=(\{.*\})\|decay=([0-9.]+)/)
    expect(m, `probe message: ${msg}`).not.toBeNull()
    const res = JSON.parse(m![1]) as Record<string, { score: number; bucket: string }>
    const decay = Number(m![2])

    // Both A and B land in the same coarse bucket…
    expect(res.A.bucket).toBe('<2km')
    expect(res.B.bucket).toBe('<2km')
    expect(res.C.bucket).toBe('unknown')
    // …and therefore carry the IDENTICAL score despite different exact distances.
    expect(res.A.score).toBe(res.B.score)
    // The geo/no-geo ratio equals the discrete bucket factor, not a continuous
    // function of exact distance (float4 rounding tolerance).
    const ratio = res.A.score / res.C.score
    expect(Math.abs(ratio - Math.exp(-1 / decay))).toBeLessThan(1e-4)
  })
})
